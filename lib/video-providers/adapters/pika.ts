import { getProviderKey } from "@/lib/provider-keys";
import type { VideoClipRequest, VideoProviderAdapter } from "../types";
import { authError, downloadToStorage } from "./shared";

const BASE_URL = "https://api.pika.art/v1";

export class PikaAdapter implements VideoProviderAdapter {
  async submit(req: VideoClipRequest): Promise<string> {
    const apiKey = await getProviderKey("pika");
    if (!apiKey) throw authError("Pika");
    const res = await fetch(`${BASE_URL}/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image: req.startImageUrl,
        duration: req.durationSeconds,
        aspect_ratio: req.aspectRatio,
        prompt: req.motionPrompt,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Pika error: ${data.message ?? data.error ?? res.statusText}`);
    const taskId = data.id ?? data.task_id;
    if (!taskId) throw new Error("Pika did not return a task ID");
    return taskId;
  }

  async poll(taskId: string) {
    const apiKey = await getProviderKey("pika");
    if (!apiKey) throw authError("Pika");
    const res = await fetch(`${BASE_URL}/videos/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Pika polling error: ${data.message ?? data.error ?? res.statusText}`);
    return {
      status: data.status === "succeeded" || data.status === "completed" ? "succeeded" as const
        : data.status === "failed" ? "failed" as const
        : data.status === "running" || data.status === "processing" ? "running" as const
        : "pending" as const,
      outputUrl: data.outputUrl ?? data.video_url ?? data.assets?.video,
      error: data.error,
    };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadToStorage(outputUrl, destPath, "pika");
  }
}

