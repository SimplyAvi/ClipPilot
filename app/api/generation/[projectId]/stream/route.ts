import { addConnection, formatEvent, removeConnection } from "@/lib/generation/sse-broadcaster";
import { getLatestJobForProject } from "@/lib/generation/job-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { projectId: string } }) {
  let heartbeat: NodeJS.Timeout | null = null;
  let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      activeController = controller;
      addConnection(params.projectId, controller);
      const job = await getLatestJobForProject(params.projectId);
      controller.enqueue(formatEvent({ type: "initial_state", data: job }));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(formatEvent({ type: "heartbeat", data: null }));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
          removeConnection(params.projectId, controller);
        }
      }, 15_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (activeController) removeConnection(params.projectId, activeController);
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
