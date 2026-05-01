import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runwayGenerationQueue } from "@/lib/queues";
import { broadcast } from "@/lib/generation/sse-broadcaster";
import type { RunwaySSEEvent } from "@/lib/runway/runway-events";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const project = await db.project.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

    const jobs = await db.generationJob.findMany({
      where: { projectId: params.id, status: { in: ["queued", "running", "paused"] } },
      select: { id: true, overallProgress: true },
    });
    await db.generationJob.updateMany({
      where: { projectId: params.id, status: { in: ["queued", "running", "paused"] } },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        isPauseRequested: true,
        currentStageLabel: "Runway generation cancelled",
      },
    });

    const cancelledClips = await db.runwayClip.findMany({
      where: {
        projectId: params.id,
        status: { in: ["queued", "submitting", "generating", "downloading", "muxing", "pending"] },
        videoPath: null,
        muxedVideoPath: null,
      },
      select: { id: true, clipId: true },
    });
    if (cancelledClips.length > 0) {
      await db.runwayClip.updateMany({
        where: {
          id: { in: cancelledClips.map((clip) => clip.id) },
          videoPath: null,
          muxedVideoPath: null,
        },
        data: {
          status: "failed",
          errorMessage: "Cancelled by user.",
        },
      });
    }
    await removeQueuedProjectJobs(params.id).catch(() => undefined);
    for (const clip of cancelledClips) {
      try {
        runwayBroadcast(params.id, {
          type: "clip_failed",
          clipId: clip.clipId,
          error: "Cancelled by user.",
          retryable: true,
          retryCount: 0,
        });
      } catch {
        // Best-effort only. The database state is the source of truth.
      }
    }
    for (const job of jobs) {
      await db.generationLog.create({
        data: {
          jobId: job.id,
          level: "warning",
          message: `Runway generation cancelled - checkpoint saved at ${Math.round(job.overallProgress)}%`,
        },
      }).catch(() => undefined);
    }
    try {
      broadcast(params.id, {
        type: "job_update",
        data: {
          projectId: params.id,
          status: "cancelled",
          currentStageLabel: "Runway generation cancelled",
        },
      });
    } catch {
      // Best-effort only. The database state is the source of truth.
    }

    return NextResponse.json({ data: { status: "cancelled" }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not cancel Runway generation";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

async function removeQueuedProjectJobs(projectId: string) {
  const jobs = await runwayGenerationQueue.getJobs(["waiting", "delayed", "prioritized"]);
  await Promise.all(
    jobs
      .filter((job) => job.data?.projectId === projectId)
      .map((job) => job.remove().catch(() => undefined))
  );
}

function runwayBroadcast(projectId: string, event: RunwaySSEEvent) {
  broadcast(projectId, { type: event.type, data: event });
}
