import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { extractLastFrame } from "@/lib/runway/frame-extractor";
import { getAbsoluteStorageUrl } from "@/lib/runway/utils";
import { getProviderConfig, getVideoProvider, type VideoAspectRatio } from "@/lib/video-providers";

export const runtime = "nodejs";

const BodySchema = z.object({
  providerId: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "4:3", "1:1"]).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;
    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        projectSlug: true,
        scenes: {
          where: { firstImagePath: { not: null } },
          orderBy: { sceneNumber: "asc" },
          select: { sceneNumber: true, firstImagePath: true },
        },
        visualSegments: {
          where: { generatedVideoPath: { not: null } },
          orderBy: { sortOrder: "asc" },
          select: { sortOrder: true, generatedVideoPath: true },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    }

    const sources = project.scenes.length > 0
      ? project.scenes.map((scene) => ({
          index: scene.sceneNumber,
          label: `Scene ${scene.sceneNumber}`,
          imagePath: scene.firstImagePath,
        }))
      : project.visualSegments.map((segment, index) => ({
          index: index + 1,
          label: `Segment ${index + 1}`,
          imagePath: segment.generatedVideoPath,
        }));
    const source = sources[0];

    if (!source?.imagePath) {
      return NextResponse.json(
        { ok: false, error: "No scene or storyboard images found. Generate and approve at least one visual first." },
        { status: 400 }
      );
    }
    const nextSource = sources[1];

    const startImageUrl = await getAbsoluteStorageUrl(source.imagePath);
    const endImageUrl = nextSource?.imagePath
      ? await getAbsoluteStorageUrl(nextSource.imagePath)
      : startImageUrl;
    const providerId = parsed.data.providerId ?? "runway";
    const provider = getProviderConfig(providerId);
    const adapter = getVideoProvider(providerId);
    const duration = provider.allowedDurations.includes(5) ? 5 : Math.min(...provider.allowedDurations);
    const aspectRatio = parsed.data.aspectRatio ?? "16:9";

    let taskId: string;
    try {
      taskId = await adapter.submit({
        startImageUrl,
        endImageUrl: provider.supportsEndFrame ? endImageUrl : undefined,
        durationSeconds: duration,
        aspectRatio,
        motionPrompt: "short cinematic test clip, smooth motion, preserve the source image composition",
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `${provider.label} submission failed: ${messageFrom(err)}` },
        { status: 502 }
      );
    }

    const result = await pollProviderTask(adapter, taskId);
    if (result.status !== "succeeded" || !result.outputUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? `${provider.label} timed out or failed`,
          taskId,
        },
        { status: 502 }
      );
    }

    const projectPath = project.projectSlug ?? `projects/${projectId}`;
    const destPath = `${projectPath}/video/test/test_clip_${String(source.index).padStart(2, "0")}.mp4`;
    await adapter.download(result.outputUrl, destPath);
    const clipId = `sc${String(source.index).padStart(2, "0")}_clip1`;
    const endFramePath = `${projectPath}/video/frames/${clipId}_end_frame.jpg`;
    await extractLastFrame(destPath, endFramePath).catch((err) => {
      console.warn("[runway-test-clip] Could not extract reusable end frame", err);
    });
    await upsertReusableTestClip({
      projectId,
      clipId,
      sceneIndex: source.index - 1,
      durationSeconds: duration,
      startImagePath: source.imagePath,
      endImagePath: nextSource?.imagePath ?? source.imagePath,
      videoPath: destPath,
      taskId,
      costUsd: provider.pricing[duration] ?? 0,
    });
    const videoUrl = await storage.getUrl(destPath);

    return NextResponse.json({
      ok: true,
      taskId,
      videoUrl,
      sceneNumber: source.index,
      sourceLabel: source.label,
      providerId,
      providerLabel: provider.label,
      durationSeconds: duration,
      costUsd: provider.pricing[duration] ?? 0,
    });
  } catch (err) {
    console.error("[runway-test-clip]", err);
    return NextResponse.json(
      {
        ok: false,
        error: normalizeRouteError(err),
      },
      { status: 500 }
    );
  }
}

async function upsertReusableTestClip(input: {
  projectId: string;
  clipId: string;
  sceneIndex: number;
  durationSeconds: number;
  startImagePath: string;
  endImagePath: string;
  videoPath: string;
  taskId: string;
  costUsd: number;
}) {
  const fullData = {
    sceneIndex: input.sceneIndex,
    clipIndex: 0,
    durationSeconds: input.durationSeconds,
    startImagePath: input.startImagePath,
    endImagePath: input.endImagePath,
    runwayTaskId: input.taskId,
    videoPath: input.videoPath,
    muxedVideoPath: input.videoPath,
    audioPath: null,
    status: "complete",
    queuePosition: null,
    submittedAt: new Date(),
    generationStart: new Date(),
    generationEnd: new Date(),
    downloadEnd: new Date(),
    muxEnd: new Date(),
    completedAt: new Date(),
    costUsd: input.costUsd,
    errorMessage: null,
    runwayPollCount: 0,
  };
  try {
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId: input.projectId, clipId: input.clipId } },
      update: fullData,
      create: {
        projectId: input.projectId,
        clipId: input.clipId,
        ...fullData,
      },
    });
  } catch (err) {
    if (!isPrismaUnknownArgument(err)) throw err;
    await db.runwayClip.upsert({
      where: { projectId_clipId: { projectId: input.projectId, clipId: input.clipId } },
      update: {
        sceneIndex: input.sceneIndex,
        clipIndex: 0,
        durationSeconds: input.durationSeconds,
        startImagePath: input.startImagePath,
        endImagePath: input.endImagePath,
        runwayTaskId: input.taskId,
        videoPath: input.videoPath,
        muxedVideoPath: input.videoPath,
        audioPath: null,
      },
      create: {
        projectId: input.projectId,
        clipId: input.clipId,
        sceneIndex: input.sceneIndex,
        clipIndex: 0,
        durationSeconds: input.durationSeconds,
        startImagePath: input.startImagePath,
        endImagePath: input.endImagePath,
        runwayTaskId: input.taskId,
        videoPath: input.videoPath,
        muxedVideoPath: input.videoPath,
        audioPath: null,
      },
    });
  }
}

async function pollProviderTask(adapter: ReturnType<typeof getVideoProvider>, taskId: string) {
  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const result = await adapter.poll(taskId);
    if (result.status === "succeeded" || result.status === "failed") return result;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { status: "failed" as const, error: "Video provider task timed out after 5 minutes" };
}

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function normalizeRouteError(err: unknown) {
  const message = messageFrom(err);
  if (message.includes("Credential access key has length")) {
    return "Cloudflare R2 credentials look swapped or malformed. R2 Access Key ID should be the 32-character key, and Secret Access Key should be the longer secret.";
  }
  if (message.includes("File not found:")) {
    return `${message} The file may still be local under a different storage path, or it may need to be regenerated.`;
  }
  return message;
}

function isPrismaUnknownArgument(err: unknown) {
  return messageFrom(err).includes("Unknown argument");
}
