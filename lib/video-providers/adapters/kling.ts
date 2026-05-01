import { getProviderKey } from "@/lib/provider-keys";
import type { VideoClipRequest, VideoProviderAdapter } from "../types";
import { authError, downloadToStorage } from "./shared";

const BASE_URL = "https://api.klingai.com/v1";

export class KlingAdapter implements VideoProviderAdapter {
  constructor(private readonly mode: "standard" | "pro") {}

  async submit(req: VideoClipRequest): Promise<string> {
    const apiKey = await getProviderKey("kling");
    if (!apiKey) throw authError("Kling");

    const res = await fetch(`${BASE_URL}/videos/image2video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: this.mode === "pro" ? "kling-v1-6-pro" : "kling-v1-6",
        image: req.startImageUrl,
        image_tail: req.endImageUrl,
        duration: String(req.durationSeconds),
        aspect_ratio: req.aspectRatio,
        cfg_scale: 0.5,
        prompt: req.motionPrompt,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Kling error: ${data.message ?? data.error ?? res.statusText}`);
    const taskId = data.data?.task_id ?? data.task_id ?? data.id;
    if (!taskId) throw new Error("Kling did not return a task ID");
    return taskId;
  }

  async poll(taskId: string) {
    const apiKey = await getProviderKey("kling");
    if (!apiKey) throw authError("Kling");
    const res = await fetch(`${BASE_URL}/videos/image2video/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Kling polling error: ${data.message ?? data.error ?? res.statusText}`);
    const status = data.data?.task_status ?? data.status;
    return {
      status: status === "succeed" || status === "succeeded" ? "succeeded" as const
        : status === "failed" ? "failed" as const
        : status === "processing" || status === "running" ? "running" as const
        : "pending" as const,
      outputUrl: data.data?.task_result?.videos?.[0]?.url ?? data.outputUrl,
      error: data.data?.task_status_msg ?? data.error,
    };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadToStorage(outputUrl, destPath, "kling");
  }
}

