import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runwayGenerationQueue } from "@/lib/queues";
import { type ClipSpec, planClips } from "@/lib/runway/clip-planner";
import { createRunwayJob } from "@/lib/generation/job-manager";
import { getProviderConfig, type VideoAspectRatio } from "@/lib/video-providers";
import { storage } from "@/lib/storage";
import { assembleProject } from "@/lib/runway/assembler";
import { muxAudioOntoClip, sliceAudioSegment } from "@/lib/runway/audio-slicer";

const BodySchema = z.object({
  ratio: z.enum(["1280:720", "720:1280", "1104:832"]).optional(),
  providerId: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "4:3", "1:1"]).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        scenes: { orderBy: { sceneNumber: "asc" } },
        visualSegments: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
    const providerId = parsed.data.providerId ?? safeProjectString(project, "videoProvider") ?? "runway";
    const providerConfig = getProviderConfig(providerId);
    const aspectRatio = parsed.data.aspectRatio ?? ratioToAspectRatio(parsed.data.ratio) ?? safeProjectString(project, "videoAspectRatio") as VideoAspectRatio | undefined ?? "16:9";

    const sceneImages = project.scenes.map((scene, index) => ({
      label: `Scene ${index + 1}`,
      imagePath: scene.firstImagePath,
    }));
    const segmentImages = project.visualSegments.map((segment, index) => ({
      label: `Segment ${index + 1}`,
      imagePath: segment.generatedVideoPath,
    }));
    const sourceImages = sceneImages.some((item) => item.imagePath) ? sceneImages : segmentImages;
    const missing = sourceImages.filter((item) => !item.imagePath).map((item) => item.label);
    if (missing.length > 0) {
      return NextResponse.json({
        data: { missing },
        error: "Some scenes are missing first images. Generate or approve images before starting Runway.",
      }, { status: 400 });
    }

    const freshPlan = await planClips(params.id, providerId);
    const existingPlan = await db.runwayClip.findMany({
      where: { projectId: project.id },
      orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }],
    }).catch(() => []);
    const clips = existingPlan.length > 0 ? mergeExistingPlan(existingPlan, freshPlan) : freshPlan;
    const queuedClips = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const existing = await db.runwayClip.findUnique({
        where: { projectId_clipId: { projectId: project.id, clipId: clip.id } },
      }).catch(() => null);
      const existingVideoPath = existing?.muxedVideoPath ?? existing?.videoPath;
      if (existingVideoPath) {
        await markReusableClip(project.id, clip, existingVideoPath, project.projectSlug ?? `projects/${project.id}`, existing?.audioPath ?? undefined);
        continue;
      }
      const reusablePath = await findReusableTestClipPath(project.projectSlug ?? `projects/${project.id}`, clip);
      if (reusablePath) {
        await markReusableClip(project.id, clip, reusablePath, project.projectSlug ?? `projects/${project.id}`);
        continue;
      }
      queuedClips.push(clip);
      await upsertQueuedClip(project.id, clip, queuedClips.length);
    }
    await db.project.update({
      where: { id: params.id },
      data: { videoProvider: providerId, videoAspectRatio: aspectRatio },
    }).catch((err) => {
      if (!String(err instanceof Error ? err.message : err).includes("Unknown argument")) throw err;
    });
    if (queuedClips.length === 0) {
      const assembledPath = await assembleProject(params.id);
      return NextResponse.json({
        data: {
          generationJobId: null,
          clipCount: 0,
          reusedClips: clips.length,
          estimatedMinutes: 0,
          providerId,
          providerLabel: providerConfig.label,
          estimatedCostUsd: 0,
          assembledVideoPath: assembledPath,
          assembledVideoUrl: await storage.getUrl(assembledPath),
        },
        error: null,
      });
    }
    const generationJob = await createRunwayJob(params.id, queuedClips, providerId);
    await runwayGenerationQueue.add(`runway-${project.id}`, {
      projectId: project.id,
      generationJobId: generationJob.id,
      clips: queuedClips,
      providerId,
      aspectRatio,
      assembleWhenComplete: true,
    }, {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    });

    return NextResponse.json({
      data: {
        generationJobId: generationJob.id,
        clipCount: queuedClips.length,
        reusedClips: clips.length - queuedClips.length,
        estimatedMinutes: Math.ceil((queuedClips.length * 45 + 30) / 60),
        providerId,
        providerLabel: providerConfig.label,
        estimatedCostUsd: queuedClips.reduce((sum, clip) => sum + (providerConfig.pricing[clip.durationSeconds] ?? 0), 0),
      },
      error: null,
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "Could not start Runway generation";
    const message = rawMessage.includes("Credential access key has length")
      ? "Cloudflare R2 credentials look swapped or malformed. In Settings -> AI Providers, R2 Access Key ID should be the 32-character Access Key ID, and Secret Access Key should be the longer secret value."
      : rawMessage;
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

async function findReusableTestClipPath(projectSlug: string, clip: Awaited<ReturnType<typeof planClips>>[number]) {
  if (clip.sceneIndex !== 0 || clip.clipIndex !== 0) return null;
  const candidate = `${projectSlug}/video/test/test_clip_01.mp4`;
  return await storage.exists(candidate).catch(() => false) ? candidate : null;
}

function mergeExistingPlan(
  existingPlan: Array<{
    clipId: string;
    sceneIndex: number;
    clipIndex: number;
    durationSeconds: number;
    startImagePath: string;
    endImagePath: string;
  }>,
  freshPlan: ClipSpec[]
): ClipSpec[] {
  const freshById = new Map(freshPlan.map((clip) => [clip.id, clip]));
  const lastClipByScene = new Map<number, number>();
  for (const clip of existingPlan) {
    lastClipByScene.set(clip.sceneIndex, Math.max(lastClipByScene.get(clip.sceneIndex) ?? 0, clip.clipIndex));
  }
  const finalSceneIndex = Math.max(...existingPlan.map((clip) => clip.sceneIndex));
  const ordered = [...existingPlan].sort((a, b) => a.sceneIndex - b.sceneIndex || a.clipIndex - b.clipIndex);
  const offsets = new Map<number, number>();
  return ordered.map((clip) => {
    const fresh = freshById.get(clip.clipId);
    const startTimeOffset = offsets.get(clip.sceneIndex) ?? 0;
    offsets.set(clip.sceneIndex, startTimeOffset + clip.durationSeconds);
    return {
      ...(fresh ?? {}),
      id: clip.clipId,
      sceneIndex: clip.sceneIndex,
      clipIndex: clip.clipIndex,
      durationSeconds: clip.durationSeconds,
      startImagePath: clip.startImagePath,
      endImagePath: clip.endImagePath,
      startTimeOffset,
      isLastClipOfScene: clip.clipIndex === lastClipByScene.get(clip.sceneIndex),
      isFinalClipOfProject: clip.sceneIndex === finalSceneIndex && clip.clipIndex === lastClipByScene.get(clip.sceneIndex),
      sourceAudioPath: fresh?.sourceAudioPath,
      audioSegmentPath: fresh?.audioSegmentPath,
    };
  });
}

async function markReusableClip(
  projectId: string,
  clip: Awaited<ReturnType<typeof planClips>>[number],
  videoPath: string,
  projectSlug: string,
  existingAudioPath?: string
) {
  const audioPath = existingAudioPath ?? (clip.sourceAudioPath
    ? await sliceAudioSegment(projectId, clip.sceneIndex, clip.clipIndex, clip.startTimeOffset, clip.durationSeconds, clip.sourceAudioPath)
    : null);
  const muxedVideoPath = audioPath
    ? await muxAudioOntoClip(
      videoPath,
      audioPath,
      `${projectSlug}/video/clips/${clip.id}_muxed.mp4`,
      { projectId, clipId: clip.id, provider: "ffmpeg" }
    )
    : videoPath;
  const fullData = {
    sceneIndex: clip.sceneIndex,
    clipIndex: clip.clipIndex,
    durationSeconds: clip.durationSeconds,
    startImagePath: clip.startImagePath,
    endImagePath: clip.endImagePath,
    runwayTaskId: null,
    videoPath,
    muxedVideoPath,
    audioPath,
    status: "complete",
    queuePosition: null,
    completedAt: new Date(),
    costUsd: 0,
    errorMessage: null,
  };
  try {
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId, clipId: clip.id } },
      update: fullData,
      create: { projectId, clipId: clip.id, ...fullData },
    });
  } catch (err) {
    if (!messageFrom(err).includes("Unknown argument")) throw err;
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId, clipId: clip.id } },
      update: {
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        runwayTaskId: null,
        videoPath,
        muxedVideoPath,
        audioPath,
      },
      create: {
        projectId,
        clipId: clip.id,
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        runwayTaskId: null,
        videoPath,
        muxedVideoPath,
        audioPath,
      },
    });
  }
}

async function upsertQueuedClip(projectId: string, clip: Awaited<ReturnType<typeof planClips>>[number], queuePosition: number) {
  const fullData = {
    sceneIndex: clip.sceneIndex,
    clipIndex: clip.clipIndex,
    durationSeconds: clip.durationSeconds,
    startImagePath: clip.startImagePath,
    endImagePath: clip.endImagePath,
    queuePosition,
    status: "queued",
    runwayTaskId: null,
    videoPath: null,
    muxedVideoPath: null,
    audioPath: null,
    submittedAt: null,
    generationStart: null,
    generationEnd: null,
    downloadEnd: null,
    muxEnd: null,
    completedAt: null,
    costUsd: null,
    errorMessage: null,
    runwayPollCount: 0,
  };
  try {
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId, clipId: clip.id } },
      update: fullData,
      create: {
        projectId,
        clipId: clip.id,
        ...fullData,
      },
    });
  } catch (err) {
    if (!messageFrom(err).includes("Unknown argument")) throw err;
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId, clipId: clip.id } },
      update: {
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        runwayTaskId: null,
        videoPath: null,
        muxedVideoPath: null,
        audioPath: null,
      },
      create: {
        projectId,
        clipId: clip.id,
        sceneIndex: clip.sceneIndex,
        clipIndex: clip.clipIndex,
        durationSeconds: clip.durationSeconds,
        startImagePath: clip.startImagePath,
        endImagePath: clip.endImagePath,
        runwayTaskId: null,
        videoPath: null,
        muxedVideoPath: null,
        audioPath: null,
      },
    });
  }
}

function safeProjectString(project: unknown, key: string): string | undefined {
  const value = (project as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function ratioToAspectRatio(ratio?: "1280:720" | "720:1280" | "1104:832"): VideoAspectRatio | undefined {
  if (ratio === "720:1280") return "9:16";
  if (ratio === "1104:832") return "4:3";
  if (ratio === "1280:720") return "16:9";
  return undefined;
}
