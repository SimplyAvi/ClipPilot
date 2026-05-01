export type VideoAspectRatio = "16:9" | "9:16" | "4:3" | "1:1";

export interface VideoClipRequest {
  startImageUrl: string;
  endImageUrl?: string;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  motionPrompt?: string;
}

export interface VideoClipResult {
  taskId: string;
  outputUrl: string;
  durationSeconds: number;
  providerCostUsd: number;
}

export interface VideoProviderAdapter {
  submit(req: VideoClipRequest): Promise<string>;
  poll(taskId: string): Promise<{
    status: "pending" | "running" | "succeeded" | "failed";
    outputUrl?: string;
    error?: string;
  }>;
  download(outputUrl: string, destPath: string): Promise<void>;
}

