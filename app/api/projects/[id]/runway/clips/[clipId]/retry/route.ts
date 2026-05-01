import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runwayGenerationQueue } from "@/lib/queues";
import type { ClipSpec } from "@/lib/runway/clip-planner";

export async function POST(_request: Request, { params }: { params: { id: string; clipId: string } }) {
  const clip = await db.runwayClip.findUnique({
    where: { projectId_clipId: { projectId: params.id, clipId: params.clipId } },
  });
  if (!clip) return NextResponse.json({ data: null, error: "Clip not found" }, { status: 404 });

  const generationJob = await db.generationJob.findUnique({ where: { projectId: params.id } });
  if (!generationJob) return NextResponse.json({ data: null, error: "Generation job not found" }, { status: 404 });
  const project = await db.project.findUnique({
    where: { id: params.id },
    select: { videoProvider: true, videoAspectRatio: true },
  });

  await db.runwayClip.update({
    where: { projectId_clipId: { projectId: params.id, clipId: params.clipId } },
    data: {
      status: "queued",
      queuePosition: 1,
      videoPath: null,
      muxedVideoPath: null,
      audioPath: null,
      runwayTaskId: null,
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
  });

  const spec: ClipSpec = {
    id: clip.clipId,
    sceneIndex: clip.sceneIndex,
    clipIndex: clip.clipIndex,
    durationSeconds: clip.durationSeconds,
    startImagePath: clip.startImagePath,
    endImagePath: clip.endImagePath,
    startTimeOffset: clip.clipIndex * clip.durationSeconds,
    isLastClipOfScene: true,
    isFinalClipOfProject: false,
    audioSegmentPath: clip.audioPath ?? undefined,
  };

  await runwayGenerationQueue.add(`retry-${clip.clipId}`, {
    projectId: params.id,
    generationJobId: generationJob.id,
    clips: [spec],
    providerId: project?.videoProvider ?? "runway",
    aspectRatio: project?.videoAspectRatio ?? "16:9",
    assembleWhenComplete: false,
  }, { attempts: 1, removeOnComplete: false, removeOnFail: false });

  return NextResponse.json({ data: { ok: true }, error: null });
}
