import type { GenerationJob, GenerationLog, GenerationTask } from "@prisma/client";

export type SSEEvent = {
  type:
    | "job_update"
    | "task_update"
    | "log"
    | "initial_state"
    | "heartbeat"
    | "clip_queued"
    | "clip_submitting"
    | "clip_generating"
    | "clip_downloading"
    | "clip_muxing"
    | "clip_complete"
    | "clip_failed"
    | "scene_complete"
    | "assembly_started"
    | "assembly_complete"
    | "job_complete"
    | "queue_snapshot";
  data: GenerationJob | GenerationTask | GenerationLog | null | unknown;
};

const connections = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();
const encoder = new TextEncoder();

export function addConnection(projectId: string, controller: ReadableStreamDefaultController<Uint8Array>): void {
  const set = connections.get(projectId) ?? new Set();
  set.add(controller);
  connections.set(projectId, set);
}

export function removeConnection(projectId: string, controller: ReadableStreamDefaultController<Uint8Array>): void {
  const set = connections.get(projectId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) connections.delete(projectId);
}

export function formatEvent(event: SSEEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

export function broadcast(projectId: string, event: SSEEvent): void {
  const set = connections.get(projectId);
  if (!set) return;
  const payload = formatEvent(event);
  for (const controller of Array.from(set)) {
    try {
      controller.enqueue(payload);
    } catch {
      set.delete(controller);
    }
  }
}
