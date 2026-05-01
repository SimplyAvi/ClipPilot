import { getProviderKey } from "@/lib/provider-keys";
import type { VideoClipRequest, VideoProviderAdapter } from "../types";
import { authError, downloadToStorage } from "./shared";

const BASE_URL = "https://api.minimax.io/v1";

export class MinimaxAdapter implements VideoProviderAdapter {
  async submit(req: VideoClipRequest): Promise<string> {
    const apiKey = await getProviderKey("minimax");
    if (!apiKey) throw authError("MiniMax");
    const res = await fetch(`${BASE_URL}/video_generation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "video-01",
        first_frame_image: req.startImageUrl,
        prompt: req.motionPrompt ?? "gentle cinematic camera movement",
        duration: req.durationSeconds,
        aspect_ratio: req.aspectRatio,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`MiniMax error: ${data.message ?? data.error ?? res.statusText}`);
    const taskId = data.task_id ?? data.id;
    if (!taskId) throw new Error("MiniMax did not return a task ID");
    return taskId;
  }

  async poll(taskId: string) {
    const apiKey = await getProviderKey("minimax");
    if (!apiKey) throw authError("MiniMax");
    const res = await fetch(`${BASE_URL}/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`MiniMax polling error: ${data.message ?? data.error ?? res.statusText}`);
    const status = data.status ?? data.task_status;
    return {
      status: status === "Success" || status === "succeeded" ? "succeeded" as const
        : status === "Fail" || status === "failed" ? "failed" as const
        : status === "Processing" || status === "running" ? "running" as const
        : "pending" as const,
      outputUrl: data.file_id ? `${BASE_URL}/files/retrieve?file_id=${encodeURIComponent(data.file_id)}` : data.video_url,
      error: data.error ?? data.message,
    };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadToStorage(outputUrl, destPath, "minimax");
  }
}

