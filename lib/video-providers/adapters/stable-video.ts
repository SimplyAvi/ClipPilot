import { getProviderKey } from "@/lib/provider-keys";
import type { VideoClipRequest, VideoProviderAdapter } from "../types";
import { authError, downloadToStorage } from "./shared";

export class StableVideoAdapter implements VideoProviderAdapter {
  async submit(req: VideoClipRequest): Promise<string> {
    const apiKey = await getProviderKey("replicate");
    if (!apiKey) throw authError("Replicate");
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "stability-ai/stable-video-diffusion",
        input: {
          input_image: req.startImageUrl,
          video_length: "25_frames",
          sizing_strategy: "maintain_aspect_ratio",
          motion_bucket_id: 127,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Replicate Stable Video error: ${data.detail ?? data.error ?? res.statusText}`);
    if (!data.id) throw new Error("Replicate did not return a prediction ID");
    return data.id;
  }

  async poll(taskId: string) {
    const apiKey = await getProviderKey("replicate");
    if (!apiKey) throw authError("Replicate");
    const res = await fetch(`https://api.replicate.com/v1/predictions/${taskId}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Replicate polling error: ${data.detail ?? data.error ?? res.statusText}`);
    return {
      status: data.status === "succeeded" ? "succeeded" as const
        : data.status === "failed" || data.status === "canceled" ? "failed" as const
        : data.status === "processing" || data.status === "starting" ? "running" as const
        : "pending" as const,
      outputUrl: Array.isArray(data.output) ? data.output[0] : data.output,
      error: data.error,
    };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadToStorage(outputUrl, destPath, "stable-video");
  }
}

