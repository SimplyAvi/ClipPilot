import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runwayGenerationQueue } from "@/lib/queues";
import { planClips } from "@/lib/runway/clip-planner";
import { createRunwayJob } from "@/lib/generation/job-manager";
import { getProviderConfig, type VideoAspectRatio } from "@/lib/video-providers";

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
    const providerId = parsed.data.providerId ?? project.videoProvider ?? "runway";
    const providerConfig = getProviderConfig(providerId);
    const aspectRatio = parsed.data.aspectRatio ?? ratioToAspectRatio(parsed.data.ratio) ?? (project.videoAspectRatio as VideoAspectRatio | null) ?? "16:9";

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

    const clips = await planClips(params.id, providerId);
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      await db.runwayClip.upsert({
        where: { projectId_clipId: { projectId: project.id, clipId: clip.id } },
        update: {
          sceneIndex: clip.sceneIndex,
          clipIndex: clip.clipIndex,
          durationSeconds: clip.durationSeconds,
          startImagePath: clip.startImagePath,
          endImagePath: clip.endImagePath,
          queuePosition: i + 1,
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
        },
        create: {
          projectId: project.id,
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
    }
    await db.project.update({
      where: { id: params.id },
      data: { videoProvider: providerId, videoAspectRatio: aspectRatio },
    });
    const generationJob = await createRunwayJob(params.id, clips, providerId);
    await runwayGenerationQueue.add(`runway-${project.id}`, {
      projectId: project.id,
      generationJobId: generationJob.id,
      clips,
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
        clipCount: clips.length,
        estimatedMinutes: Math.ceil((clips.length * 45 + 30) / 60),
        providerId,
        providerLabel: providerConfig.label,
        estimatedCostUsd: clips.reduce((sum, clip) => sum + (providerConfig.pricing[clip.durationSeconds] ?? 0), 0),
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

function ratioToAspectRatio(ratio?: "1280:720" | "720:1280" | "1104:832"): VideoAspectRatio | undefined {
  if (ratio === "720:1280") return "9:16";
  if (ratio === "1104:832") return "4:3";
  if (ratio === "1280:720") return "16:9";
  return undefined;
}
