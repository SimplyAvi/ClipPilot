import { addConnection, formatEvent, removeConnection } from "@/lib/generation/sse-broadcaster";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { RunwayClipStatus, RunwayClipSummary } from "@/lib/runway/runway-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let heartbeat: NodeJS.Timeout | null = null;
  let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      activeController = controller;
      addConnection(params.id, controller);
      controller.enqueue(formatEvent({ type: "queue_snapshot", data: { type: "queue_snapshot", clips: await getSnapshot(params.id) } }));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(formatEvent({ type: "heartbeat", data: null }));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
          removeConnection(params.id, controller);
        }
      }, 15_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (activeController) removeConnection(params.id, activeController);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getSnapshot(projectId: string): Promise<RunwayClipSummary[]> {
  const clips = await db.runwayClip.findMany({
    where: { projectId },
    orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }],
  });

  return Promise.all(
    clips.map(async (clip) => ({
      clipId: clip.clipId,
      sceneIndex: clip.sceneIndex,
      clipIndex: clip.clipIndex,
      status: normalizeStatus(clip.status),
      durationSeconds: clip.durationSeconds,
      queuePosition: clip.queuePosition ?? undefined,
      runwayTaskId: clip.runwayTaskId ?? undefined,
      videoUrl: clip.muxedVideoPath ? await storage.getUrl(clip.muxedVideoPath) : clip.videoPath ? await storage.getUrl(clip.videoPath) : undefined,
      costUsd: clip.costUsd ?? undefined,
      errorMessage: clip.errorMessage ?? undefined,
      retryCount: clip.retryCount,
      elapsedMs: clip.status === "generating" && clip.generationStart ? Date.now() - clip.generationStart.getTime() : undefined,
    }))
  );
}

function normalizeStatus(status: string): RunwayClipStatus {
  if (
    status === "queued" ||
    status === "submitting" ||
    status === "generating" ||
    status === "downloading" ||
    status === "muxing" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }
  return status === "pending" ? "queued" : "failed";
}
