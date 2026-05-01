import { Worker, Job } from "bullmq";
import { redisConfig } from "@/lib/redis";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { appendLog, completeTask, failTask, findTaskByMetadata, startTask, updateTaskProgress } from "@/lib/generation/job-manager";
import { broadcast } from "@/lib/generation/sse-broadcaster";
import { assembleProject } from "@/lib/runway/assembler";
import { muxAudioOntoClip, sliceAudioSegment } from "@/lib/runway/audio-slicer";
import type { ClipSpec } from "@/lib/runway/clip-planner";
import { extractLastFrame } from "@/lib/runway/frame-extractor";
import { getAbsoluteStorageUrl, pad2 } from "@/lib/runway/utils";
import type { RunwaySSEEvent } from "@/lib/runway/runway-events";
import { getProviderConfig, getVideoProvider, type VideoAspectRatio } from "@/lib/video-providers";

export interface RunwayGenerationJob {
  projectId: string;
  generationJobId: string;
  clips: ClipSpec[];
  ratio?: "1280:720" | "720:1280" | "1104:832";
  providerId?: string;
  aspectRatio?: VideoAspectRatio;
  assembleWhenComplete?: boolean;
}

async function processRunwayGeneration(job: Job<RunwayGenerationJob>) {
  const { projectId, generationJobId } = job.data;
  const providerId = job.data.providerId ?? "runway";
  const aspectRatio = job.data.aspectRatio ?? ratioToAspectRatio(job.data.ratio) ?? "16:9";
  const providerConfig = getProviderConfig(providerId);
  const adapter = getVideoProvider(providerId);
  const clips = [...job.data.clips].sort((a, b) => a.sceneIndex - b.sceneIndex || a.clipIndex - b.clipIndex);
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true, projectSlug: true } });
  if (!project) throw new Error("Project not found");
  const projectSlug = project.projectSlug ?? slugify(project.name);

  await db.generationJob.update({
    where: { id: generationJobId },
    data: { status: "running", startedAt: new Date(), currentStageLabel: `${providerConfig.label} Image-to-Video` },
  });
  await appendLog(generationJobId, "info", `${providerConfig.label} image-to-video generation started`);

  const stage = await findTaskByMetadata(projectId, "stableKey", "stage:runway_generation");
  if (stage) await startTask(stage.id);

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId, clipId: clip.id } },
      update: {
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        queuePosition: i + 1,
        status: "queued",
        errorMessage: null,
      },
      create: {
        projectId,
        clipId: clip.id,
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        queuePosition: i + 1,
        status: "queued",
      },
    });
    runwayBroadcast(projectId, {
      type: "clip_queued",
      clipId: clip.id,
      sceneIndex: clip.sceneIndex,
      clipIndex: clip.clipIndex,
      queuePosition: i + 1,
      durationSeconds: clip.durationSeconds,
    });
  }

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (await isGenerationCancelled(generationJobId)) {
      await appendLog(generationJobId, "warning", "Runway generation cancelled before next clip.");
      break;
    }
    const task = await findTaskByMetadata(projectId, "stableKey", `runway:${clip.id}`);
    const startedAt = Date.now();
    if (task) await startTask(task.id);

    try {
      await db.runwayClip.upsert({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        update: {
          sceneIndex: clip.sceneIndex,
          clipIndex: clip.clipIndex,
          durationSeconds: clip.durationSeconds,
          startImagePath: clip.startImagePath,
          endImagePath: clip.endImagePath,
          status: "submitting",
          queuePosition: null,
          submittedAt: new Date(),
          generationStart: null,
          generationEnd: null,
          downloadEnd: null,
          muxEnd: null,
          completedAt: null,
          costUsd: null,
          errorMessage: null,
          runwayPollCount: 0,
        },
        create: {
          projectId,
          clipId: clip.id,
          sceneIndex: clip.sceneIndex,
          clipIndex: clip.clipIndex,
          durationSeconds: clip.durationSeconds,
          startImagePath: clip.startImagePath,
          endImagePath: clip.endImagePath,
          status: "submitting",
          submittedAt: new Date(),
        },
      });
      runwayBroadcast(projectId, { type: "clip_submitting", clipId: clip.id });

      if (task) await updateTaskProgress(task.id, 10, `Preparing ${clip.id} start and end frames`);
      const promptImage = await getAbsoluteStorageUrl(clip.startImagePath);
      const promptImageEndPath = await storage.exists(clip.endImagePath) ? clip.endImagePath : clip.startImagePath;
      const promptImageEnd = await getAbsoluteStorageUrl(promptImageEndPath);

      if (task) await updateTaskProgress(task.id, 20, `Sending ${clip.id} to ${providerConfig.label}`);
      const runwayTaskId = await adapter.submit({
        startImageUrl: promptImage,
        endImageUrl: providerConfig.supportsEndFrame ? promptImageEnd : undefined,
        durationSeconds: clip.durationSeconds,
        aspectRatio,
        motionPrompt: "cinematic motion, smooth camera movement, preserve the composition and mood of the source image",
      });
      await db.runwayClip.update({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        data: { runwayTaskId, status: "generating", generationStart: new Date(), runwayPollCount: 0 },
      });
      runwayBroadcast(projectId, { type: "clip_generating", clipId: clip.id, runwayTaskId, pollCount: 0, elapsedMs: 0 });

      if (task) await updateTaskProgress(task.id, 35, `Waiting for ${providerConfig.label} task ${runwayTaskId}`);
      const result = await pollProviderTask(adapter, projectId, clip.id, runwayTaskId);
      if (task) await updateTaskProgress(task.id, 70, `${providerConfig.label} task finished`);
      if (result.status !== "succeeded" || !result.outputUrl) {
        throw new Error(result.error ?? `${providerConfig.label} clip failed`);
      }

      if (task) await updateTaskProgress(task.id, 75, `Downloading ${clip.id}`);
      await db.runwayClip.update({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        data: { status: "downloading", generationEnd: new Date() },
      });
      runwayBroadcast(projectId, { type: "clip_downloading", clipId: clip.id });
      const rawPath = `${projectSlug}/video/clips/${clip.id}.mp4`;
      await adapter.download(result.outputUrl, rawPath);

      if (!clip.isLastClipOfScene) {
        if (task) await updateTaskProgress(task.id, 82, `Extracting continuity frame for ${clip.id}`);
        const framePath = await extractLastFrame(rawPath, `${projectSlug}/video/frames/${clip.id}_end_frame.jpg`);
        const next = clips[i + 1];
        if (next && next.sceneIndex === clip.sceneIndex) next.startImagePath = framePath;
      }

      if (task) await updateTaskProgress(task.id, 88, `Slicing narrator audio for ${clip.id}`);
      const audioPath = clip.audioSegmentPath ?? (clip.sourceAudioPath
        ? await sliceAudioSegment(projectId, clip.sceneIndex, clip.clipIndex, clip.startTimeOffset, clip.durationSeconds, clip.sourceAudioPath)
        : undefined);

      if (task) await updateTaskProgress(task.id, 94, `Muxing audio onto ${clip.id}`);
      await db.runwayClip.update({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        data: { status: "muxing", downloadEnd: new Date() },
      });
      runwayBroadcast(projectId, { type: "clip_muxing", clipId: clip.id });
      const muxedPath = await muxAudioOntoClip(
        rawPath,
        audioPath ?? null,
        `${projectSlug}/video/clips/${clip.id}_muxed.mp4`,
        { projectId, clipId: clip.id, provider: "ffmpeg" }
      );

      const costUsd = providerConfig.pricing[clip.durationSeconds] ?? 0;
      const finishedAt = new Date();
      const updatedClip = await db.runwayClip.update({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        data: {
          status: "complete",
          videoPath: rawPath,
          muxedVideoPath: muxedPath,
          audioPath: audioPath ?? null,
          muxEnd: finishedAt,
          completedAt: finishedAt,
          costUsd,
          errorMessage: null,
        },
        select: { submittedAt: true },
      });
      const videoUrl = await storage.getUrl(muxedPath);
      const totalCostSoFar = await calculateRunningCost(projectId);
      runwayBroadcast(projectId, {
        type: "clip_complete",
        clipId: clip.id,
        sceneIndex: clip.sceneIndex,
        videoUrl,
        durationMs: updatedClip.submittedAt ? finishedAt.getTime() - updatedClip.submittedAt.getTime() : Date.now() - startedAt,
        costUsd,
        totalCostSoFar,
      });
      await refreshQueuePositions(projectId);
      await maybeBroadcastSceneComplete(projectId, clip.sceneIndex);
      if (task) await completeTask(task.id, costUsd, (Date.now() - startedAt) / 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Runway clip generation failed";
      const failed = await db.runwayClip.update({
        where: { projectId_clipId: { projectId, clipId: clip.id } },
        data: { status: "failed", errorMessage: message, retryCount: { increment: 1 } },
        select: { retryCount: true },
      }).catch(() => undefined);
      runwayBroadcast(projectId, {
        type: "clip_failed",
        clipId: clip.id,
        error: message,
        retryable: (failed?.retryCount ?? 1) < 3,
        retryCount: failed?.retryCount ?? 1,
      });
      if (task) await failTask(task.id, message);
      await appendLog(generationJobId, "error", `${clip.id} failed: ${message}`);
    }
  }

  if (stage) await completeTask(stage.id, 0, 0.1);
  if (job.data.assembleWhenComplete !== false) {
    if (await isGenerationCancelled(generationJobId)) {
      await appendLog(generationJobId, "warning", "Runway assembly skipped because generation was cancelled.");
      return;
    }
    const assemblyStage = await findTaskByMetadata(projectId, "stableKey", "stage:runway_assembly");
    if (assemblyStage) await startTask(assemblyStage.id);
    try {
      const assemblyStartedAt = Date.now();
      runwayBroadcast(projectId, { type: "assembly_started" });
      if (assemblyStage) await updateTaskProgress(assemblyStage.id, 30, "Assembling completed Runway clips");
      const outputPath = await assembleProject(projectId);
      if (assemblyStage) await updateTaskProgress(assemblyStage.id, 90, `Final video saved: ${outputPath}`);
      if (assemblyStage) await completeTask(assemblyStage.id, 0, 1);
      await appendLog(generationJobId, "success", "Runway assembly complete");
      const totalCostUsd = await calculateRunningCost(projectId);
      const assembled = await db.assembledVideo.findUnique({ where: { projectId } });
      if (assembled) {
        runwayBroadcast(projectId, {
          type: "assembly_complete",
          videoUrl: await storage.getUrl(assembled.videoPath),
          totalCostUsd,
          totalDurationMs: Date.now() - assemblyStartedAt,
        });
      }
      runwayBroadcast(projectId, {
        type: "job_complete",
        totalCostUsd,
        totalClips: clips.length,
        totalDurationMs: Date.now() - (job.timestamp ?? Date.now()),
      });
    } catch (err) {
      if (assemblyStage) await failTask(assemblyStage.id, err instanceof Error ? err.message : "Runway assembly failed");
    }
  }
}

async function isGenerationCancelled(generationJobId: string): Promise<boolean> {
  const generationJob = await db.generationJob.findUnique({
    where: { id: generationJobId },
    select: { status: true },
  });
  return generationJob?.status === "cancelled";
}

async function pollProviderTask(
  adapter: ReturnType<typeof getVideoProvider>,
  projectId: string,
  clipId: string,
  providerTaskId: string
) {
  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const result = await adapter.poll(providerTaskId);
    const row = await db.runwayClip.update({
      where: { projectId_clipId: { projectId, clipId } },
      data: { status: "generating", runwayPollCount: { increment: 1 } },
      select: { runwayPollCount: true, generationStart: true },
    });
    runwayBroadcast(projectId, {
      type: "clip_generating",
      clipId,
      runwayTaskId: providerTaskId,
      pollCount: row.runwayPollCount,
      elapsedMs: row.generationStart ? Date.now() - row.generationStart.getTime() : 0,
    });
    if (result.status === "succeeded" || result.status === "failed") return result;
    await sleep(5000);
  }
  return { status: "failed" as const, error: "Video provider task timed out after 5 minutes" };
}

function ratioToAspectRatio(ratio?: "1280:720" | "720:1280" | "1104:832"): VideoAspectRatio | undefined {
  if (ratio === "720:1280") return "9:16";
  if (ratio === "1104:832") return "4:3";
  if (ratio === "1280:720") return "16:9";
  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runwayBroadcast(projectId: string, event: RunwaySSEEvent) {
  broadcast(projectId, { type: event.type, data: event });
}

async function calculateRunningCost(projectId: string): Promise<number> {
  const clips = await db.runwayClip.findMany({
    where: { projectId, status: "complete" },
    select: { costUsd: true },
  });
  return clips.reduce((sum, clip) => sum + (clip.costUsd ?? 0), 0);
}

async function refreshQueuePositions(projectId: string): Promise<void> {
  const queuedClips = await db.runwayClip.findMany({
    where: { projectId, status: "queued" },
    orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }],
  });
  for (let i = 0; i < queuedClips.length; i++) {
    const updated = await db.runwayClip.update({
      where: { id: queuedClips[i].id },
      data: { queuePosition: i + 1 },
    });
    runwayBroadcast(projectId, {
      type: "clip_queued",
      clipId: updated.clipId,
      sceneIndex: updated.sceneIndex,
      clipIndex: updated.clipIndex,
      queuePosition: i + 1,
      durationSeconds: updated.durationSeconds,
    });
  }
}

async function maybeBroadcastSceneComplete(projectId: string, sceneIndex: number): Promise<void> {
  const sceneClips = await db.runwayClip.findMany({
    where: { projectId, sceneIndex },
    select: { status: true },
  });
  if (sceneClips.length > 0 && sceneClips.every((clip) => clip.status === "complete")) {
    runwayBroadcast(projectId, { type: "scene_complete", sceneIndex, clipCount: sceneClips.length });
  }
}

export function startRunwayGenerationWorker() {
  const worker = new Worker<RunwayGenerationJob>("runway-generation", processRunwayGeneration, {
    connection: redisConfig,
    concurrency: 1,
    limiter: { max: 1, duration: 1_000 },
  });

  worker.on("completed", (job) => console.log(`[runway-gen] BullMQ job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[runway-gen] BullMQ job ${job?.id} failed:`, err.message));
  worker.on("error", (err) => console.error("[runway-gen] Worker error:", err.message));
  return worker;
}
