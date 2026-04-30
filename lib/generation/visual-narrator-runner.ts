import { db } from "@/lib/db";
import { buildVoiceSettings, textToSpeech } from "@/lib/voice-client";
import { createSdxlPrediction, waitForReplicatePrediction } from "@/lib/replicate";
import { getProviderKey } from "@/lib/provider-keys";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { buildVisualPromptWithTheme } from "@/lib/themes/theme-context";
import { assembleVisualNarratorVideo } from "@/lib/assembler/visual-narrator-assembler";
import { appendLog, completeTask, failTask, findTaskByMetadata, startTask, updateTaskProgress } from "@/lib/generation/job-manager";

const NEGATIVE_PROMPT =
  "person, people, human, face, body, silhouette, hands, figure, crowd, man, woman, child, portrait, character";

export async function runVisualNarratorGeneration(projectId: string, jobId: string) {
  await db.generationJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), currentStageLabel: "Visual Generation" },
  });
  await appendLog(jobId, "info", "Visual narrator generation started");

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      theme: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
      narratorProfile: true,
      projectMusicTrack: true,
    },
  });
  if (!project) throw new Error("Project not found");

  await completeStage(projectId, jobId, "script_segmentation", "Storyboard already segmented and approved");
  await generateVisualSegments(project, jobId);
  await generateNarratorAudio(project.id, jobId);
  await handleMusic(project.id, jobId);
  await handleAssembly(project.id, jobId);
  await completeStage(projectId, jobId, "color_grade", "Color grade queued for final export");
  await completeStage(projectId, jobId, "export", "Ready for export");
  await appendLog(jobId, "success", "Visual narrator generation pipeline finished");
}

async function generateVisualSegments(project: {
  id: string;
  name: string;
  projectSlug: string | null;
  theme: Parameters<typeof buildVisualPromptWithTheme>[1];
  visualSegments: Array<{
    id: string;
    sortOrder: number;
    visualConcept: string;
    primarySubject: string;
    movementStyle: string;
    cameraApproach: string;
    colorTemperature: string;
    generatedVideoPath: string | null;
    variantPaths: string | null;
  }>;
}, jobId: string) {
  const stage = await findTaskByMetadata(project.id, "stableKey", "stage:visual_generation");
  if (stage) await startTask(stage.id);

  const token = await getProviderKey("replicate");
  if (!token) {
    const message = "Add your Replicate API key in Settings -> AI Providers to generate visual segments.";
    if (stage) await failTask(stage.id, message);
    await appendLog(jobId, "error", message);
    return;
  }

  const projectSlug = project.projectSlug ?? slugify(project.name);
  for (const segment of project.visualSegments) {
    const task = await findTaskByMetadata(project.id, "stableKey", `visual:${segment.id}`);
    if (!task) continue;

    if (segment.generatedVideoPath) {
      await completeTask(task.id, 0, 0.1);
      continue;
    }

    const startedAt = Date.now();
    await startTask(task.id);
    await db.visualSegment.update({ where: { id: segment.id }, data: { status: "generating" } });

    try {
      await updateTaskProgress(task.id, 10, `Building visual prompt for segment ${segment.sortOrder + 1}`);
      const basePrompt = `${segment.visualConcept}. ${segment.primarySubject} shown in detail. ${segment.movementStyle} camera movement. ${segment.cameraApproach} framing. ${segment.colorTemperature} color temperature. No people, no human figures, no faces, no hands, no silhouettes, no body parts. Purely environmental, natural, or abstract imagery. Negative prompt must exclude: ${NEGATIVE_PROMPT}.`;
      const prompt = buildVisualPromptWithTheme(basePrompt, project.theme);
      const variants: string[] = [];

      await updateTaskProgress(task.id, 25, "Sending visual to Replicate");
      const prediction = await createSdxlPrediction(token, prompt);
      const urls = prediction.output?.length ? prediction.output : await waitForReplicatePrediction(token, prediction.urls.get);
      const imageUrl = urls[0];
      if (!imageUrl) throw new Error("Replicate returned no image");
      await updateTaskProgress(task.id, 70, "Downloading generated visual");
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Could not download generated image: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filePath = `${projectSlug}/visual_narrator/segments/seg_${String(segment.sortOrder + 1).padStart(2, "0")}_v1.png`;
      const stored = await storage.save(filePath, buffer, "image/png", {
        projectId: project.id,
        segmentId: segment.id,
        provider: "replicate",
        negativePrompt: NEGATIVE_PROMPT,
      });
      variants.push(stored.path);

      await updateTaskProgress(task.id, 90, "Saving generated visual");
      await db.visualSegment.update({
        where: { id: segment.id },
        data: {
          generationPrompt: prompt,
          generatedVideoPath: variants[0],
          variantPaths: JSON.stringify(variants),
          approvedVariantIdx: 0,
          status: "generated",
        },
      });
      await completeTask(task.id, 0.18, elapsedSeconds(startedAt));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Visual generation failed";
      await db.visualSegment.update({ where: { id: segment.id }, data: { status: "failed", additionalNotes: message } });
      await failTask(task.id, message);
    }
  }

  if (stage) await completeTask(stage.id, 0, 0.1);
}

async function generateNarratorAudio(projectId: string, jobId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { narratorProfile: true, visualSegments: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) return;

  const stage = await findTaskByMetadata(projectId, "stableKey", "stage:narrator_audio");
  if (stage) await startTask(stage.id);

  if (!project.narratorProfile?.voiceId) {
    const message = "Choose a narrator voice before narrator audio can be generated.";
    if (stage) await failTask(stage.id, message);
    await appendLog(jobId, "warning", message);
    return;
  }

  const settings = {
    ...buildVoiceSettings(normalizePace(project.narratorProfile.pace), normalizeRange(project.narratorProfile.emotionalRange)),
    stability: 0.75,
    similarity_boost: 0.75,
  };
  const projectSlug = project.projectSlug ?? slugify(project.name);

  for (const segment of project.visualSegments) {
    const task = await findTaskByMetadata(projectId, "stableKey", `audio:${segment.id}`);
    if (!task) continue;
    if (segment.narratorAudioPath) {
      await completeTask(task.id, 0, segment.durationSeconds ?? 0.1);
      continue;
    }

    const startedAt = Date.now();
    await startTask(task.id);
    try {
      await updateTaskProgress(task.id, 25, `Generating narrator audio for segment ${segment.sortOrder + 1}`);
      const text = project.narratorProfile.deliveryStyle
        ? `[${project.narratorProfile.deliveryStyle}] ${segment.stanzaText}`
        : segment.stanzaText;
      const audio = Buffer.from(await textToSpeech(project.narratorProfile.voiceId, text, settings));
      await updateTaskProgress(task.id, 80, "Saving narrator audio");
      const durationSeconds = estimateDuration(segment.stanzaText, project.narratorProfile.pace);
      const path = `${projectSlug}/narrator/narrator_seg_${String(segment.sortOrder + 1).padStart(2, "0")}_v1.mp3`;
      const stored = await storage.save(path, audio, "audio/mpeg", {
        projectId,
        segmentId: segment.id,
        provider: "elevenlabs",
      });
      await db.visualSegment.update({
        where: { id: segment.id },
        data: { narratorAudioPath: stored.path, durationSeconds },
      });
      await completeTask(task.id, 0.01, elapsedSeconds(startedAt));
    } catch (err) {
      await failTask(task.id, err instanceof Error ? err.message : "Narrator audio generation failed");
    }
  }

  if (stage) await completeTask(stage.id, 0, 0.1);
}

async function handleMusic(projectId: string, jobId: string) {
  const stage = await findTaskByMetadata(projectId, "stableKey", "stage:music_score");
  if (!stage) return;
  await startTask(stage.id);
  const track = await db.projectMusicTrack.findUnique({ where: { projectId } });
  if (track?.audioPath) {
    await completeTask(stage.id, 0, 0.1);
    return;
  }
  await appendLog(jobId, "warning", "Music is not generated yet. Continue with visuals/audio, then use Music Score to add a track.");
  await completeTask(stage.id, 0, 0.1);
}

async function handleAssembly(projectId: string, jobId: string) {
  const stage = await findTaskByMetadata(projectId, "stableKey", "stage:assembly_stitch");
  if (!stage) return;
  const startedAt = Date.now();
  await startTask(stage.id);
  try {
    await updateTaskProgress(stage.id, 40, "Building timing map and assembly manifest");
    const outputPath = await assembleVisualNarratorVideo(projectId);
    await updateTaskProgress(stage.id, 90, `Assembly manifest saved: ${outputPath}`);
    await completeTask(stage.id, 0, elapsedSeconds(startedAt));
  } catch (err) {
    await failTask(stage.id, err instanceof Error ? err.message : "Assembly failed");
  }
}

async function completeStage(projectId: string, jobId: string, stageType: string, message: string) {
  const stage = await findTaskByMetadata(projectId, "stableKey", `stage:${stageType}`);
  if (!stage) return;
  await startTask(stage.id);
  await appendLog(jobId, "info", message, stage.id);
  await completeTask(stage.id, 0, 0.1);
}

function normalizePace(value: string): "slow" | "normal" | "fast" {
  if (value === "slow") return "slow";
  if (value === "expressive") return "fast";
  return "normal";
}

function normalizeRange(value: string): "restrained" | "moderate" | "expressive" {
  if (value === "low" || value === "restrained") return "restrained";
  if (value === "high" || value === "expressive") return "expressive";
  return "moderate";
}

function estimateDuration(text: string, pace: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wpm = pace === "slow" ? 105 : pace === "expressive" ? 155 : 125;
  return Math.max(1.5, (words / wpm) * 60);
}

function elapsedSeconds(startedAt: number) {
  return (Date.now() - startedAt) / 1000;
}
