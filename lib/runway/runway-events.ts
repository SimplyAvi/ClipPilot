export type RunwayClipStatus =
  | "queued"
  | "submitting"
  | "generating"
  | "downloading"
  | "muxing"
  | "complete"
  | "failed";

export interface RunwayClipSummary {
  clipId: string;
  sceneIndex: number;
  clipIndex: number;
  status: RunwayClipStatus;
  durationSeconds: number;
  queuePosition?: number;
  runwayTaskId?: string;
  videoUrl?: string;
  costUsd?: number;
  errorMessage?: string;
  retryCount: number;
  elapsedMs?: number;
}

export type RunwaySSEEvent =
  | {
      type: "clip_queued";
      clipId: string;
      sceneIndex: number;
      clipIndex: number;
      queuePosition: number;
      durationSeconds: number;
    }
  | { type: "clip_submitting"; clipId: string }
  | { type: "clip_generating"; clipId: string; runwayTaskId: string; pollCount: number; elapsedMs: number }
  | { type: "clip_downloading"; clipId: string }
  | { type: "clip_muxing"; clipId: string }
  | {
      type: "clip_complete";
      clipId: string;
      sceneIndex: number;
      videoUrl: string;
      durationMs: number;
      costUsd: number;
      totalCostSoFar: number;
    }
  | { type: "clip_failed"; clipId: string; error: string; retryable: boolean; retryCount: number }
  | { type: "scene_complete"; sceneIndex: number; clipCount: number }
  | { type: "assembly_started" }
  | { type: "assembly_complete"; videoUrl: string; totalCostUsd: number; totalDurationMs: number }
  | { type: "job_complete"; totalCostUsd: number; totalClips: number; totalDurationMs: number }
  | { type: "queue_snapshot"; clips: RunwayClipSummary[] };
