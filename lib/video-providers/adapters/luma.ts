import { getProviderKey } from "@/lib/provider-keys";
import type { VideoClipRequest, VideoProviderAdapter } from "../types";
import { authError, downloadToStorage } from "./shared";

const BASE_URL = "https://api.lumalabs.ai/dream-machine/v1";

export class LumaAdapter implements VideoProviderAdapter {
  async submit(req: VideoClipRequest): Promise<string> {
    const apiKey = await getProviderKey("luma");
    if (!apiKey) throw authError("Luma");
    const res = await fetch(`${BASE_URL}/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "ray-2",
        duration: req.durationSeconds,
        aspect_ratio: req.aspectRatio,
        prompt: req.motionPrompt,
        keyframes: {
          frame0: { type: "image", url: req.startImageUrl },
          ...(req.endImageUrl ? { frame1: { type: "image", url: req.endImageUrl } } : {}),
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Luma error: ${data.message ?? data.error ?? res.statusText}`);
    if (!data.id) throw new Error("Luma did not return a task ID");
    return data.id;
  }

  async poll(taskId: string) {
    const apiKey = await getProviderKey("luma");
    if (!apiKey) throw authError("Luma");
    const res = await fetch(`${BASE_URL}/generations/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Luma polling error: ${data.message ?? data.error ?? res.statusText}`);
    return {
      status: data.state === "completed" ? "succeeded" as const
        : data.state === "failed" ? "failed" as const
        : "running" as const,
      outputUrl: data.assets?.video,
      error: data.failure_reason,
    };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadToStorage(outputUrl, destPath, "luma");
  }
}

