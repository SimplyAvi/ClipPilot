/**
 * GET /api/jobs/[id]/progress
 *
 * Server-Sent Events endpoint. Polls the DB every 2 seconds and pushes
 * the current job state (status, progress, shots, cost) to the client.
 *
 * Closes automatically when the job reaches a terminal state
 * (COMPLETE, FAILED, CANCELLED) or after 30 minutes of inactivity.
 */

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2_000;
const MAX_DURATION_MS = 30 * 60 * 1_000; // 30 minutes

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();

      const push = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseMessage(event, data)));
      };

      const TERMINAL = new Set(["COMPLETE", "FAILED", "CANCELLED"]);

      const tick = async () => {
        try {
          const job = await db.job.findUnique({
            where: { id: jobId },
          });

          if (!job) {
            push("error", { message: "Job not found" });
            controller.close();
            return;
          }

          // Fetch all scenes + shots for the project under this job type
          const scenes = await db.scene.findMany({
            where: { projectId: job.projectId },
            include: {
              shots: {
                orderBy: { shotNumber: "asc" },
              },
            },
            orderBy: { sceneNumber: "asc" },
          });

          const payload = {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            costSoFar: job.costSoFar,
            estimatedCost: job.estimatedCost,
            totalShots: job.totalShots,
            completedShots: job.completedShots,
            error: job.error,
            scenes: scenes.map((scene) => ({
              id: scene.id,
              sceneNumber: scene.sceneNumber,
              title: scene.title,
              status: scene.status,
              shots: scene.shots.map((shot) => ({
                id: shot.id,
                shotNumber: shot.shotNumber,
                shotType: shot.shotType,
                duration: shot.duration,
                status: shot.status,
                generatedVideoPath: shot.generatedVideoPath,
                thumbnailPath: shot.thumbnailPath,
                likenessChecked: shot.likenessChecked,
                likenessCheckPassed: shot.likenessCheckPassed,
                likenessMatchedName: shot.likenessMatchedName,
                flaggedReason: shot.flaggedReason,
                generationCostUsd: shot.generationCostUsd,
              })),
            })),
          };

          push("progress", payload);

          if (TERMINAL.has(job.status)) {
            push("done", { status: job.status });
            controller.close();
            return;
          }

          if (Date.now() - startedAt > MAX_DURATION_MS) {
            push("timeout", { message: "Stream closed after 30 minutes" });
            controller.close();
            return;
          }

          // Schedule next poll
          setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          push("error", { message: msg });
          controller.close();
        }
      };

      // Initial tick immediately
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
