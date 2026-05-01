import { getProviderKey } from "@/lib/provider-keys";
import { storage } from "@/lib/storage";

const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";

export interface RunwayClipRequest {
  promptImage: string;
  promptImageEnd: string;
  seconds: 5 | 10;
  ratio?: "1280:768" | "768:1280";
  model?: "gen3a_turbo";
  promptText?: string;
}

export interface RunwayClipResult {
  taskId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputUrl?: string;
  error?: string;
}

export async function submitRunwayClip(req: RunwayClipRequest): Promise<string> {
  const key = await getProviderKey("runway");
  if (!key) throw new Error("Add your Runway ML API key in Settings -> AI Providers to generate video clips.");

  const res = await runwayFetch(`${RUNWAY_BASE_URL}/image_to_video`, {
    method: "POST",
    headers: runwayHeaders(key),
    body: JSON.stringify({
      model: req.model ?? "gen3a_turbo",
      promptImage: buildPromptImage(req.promptImage, req.promptImageEnd),
      promptText: req.promptText ?? "Smooth cinematic camera movement with natural parallax and subtle environmental motion.",
      duration: req.seconds,
      ratio: req.ratio ?? "1280:768",
    }),
  });

  const json = await readJsonOrText(res);
  if (!res.ok) throw new Error(extractRunwayError(json, `Runway request failed (${res.status})`));
  const taskId = json.id ?? json.taskId;
  if (!taskId) throw new Error("Runway did not return a task ID");
  return taskId;
}

export async function pollRunwayClip(
  taskId: string,
  onPoll?: (result: RunwayClipResult) => Promise<void> | void
): Promise<RunwayClipResult> {
  const key = await getProviderKey("runway");
  if (!key) throw new Error("Runway ML API key is missing.");

  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const res = await runwayFetch(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
      headers: runwayHeaders(key),
    });
    const json = await readJsonOrText(res);
    if (!res.ok) throw new Error(extractRunwayError(json, `Runway polling failed (${res.status})`));

    const status = normalizeStatus(json.status);
    await onPoll?.({ taskId, status });
    if (status === "succeeded") {
      const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output ?? json.outputUrl;
      return { taskId, status, outputUrl };
    }
    if (status === "failed") {
      return { taskId, status, error: json.error?.message ?? json.failure ?? "Runway task failed" };
    }
    await sleep(5000);
  }

  return { taskId, status: "failed", error: "Runway task timed out after 5 minutes" };
}

export async function pollRunwayClipOnce(taskId: string): Promise<RunwayClipResult> {
  const key = await getProviderKey("runway");
  if (!key) throw new Error("Runway ML API key is missing.");

  const res = await runwayFetch(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
    headers: runwayHeaders(key),
  });
  const json = await readJsonOrText(res);
  if (!res.ok) throw new Error(extractRunwayError(json, `Runway polling failed (${res.status})`));

  const status = normalizeStatus(json.status);
  if (status === "succeeded") {
    const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output ?? json.outputUrl;
    return { taskId, status, outputUrl };
  }
  if (status === "failed") {
    return { taskId, status, error: json.error?.message ?? json.failure ?? "Runway task failed" };
  }
  return { taskId, status };
}

export async function downloadRunwayClip(outputUrl: string, destPath: string): Promise<void> {
  const res = await fetch(outputUrl);
  if (!res.ok) throw new Error(`Could not download Runway clip (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await storage.save(destPath, buffer, "video/mp4", { provider: "runway" });
}

function runwayHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "X-Runway-Version": "2024-11-06",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function buildPromptImage(first: string, last?: string) {
  if (!last || last === first) return first;
  return [
    { uri: first, position: "first" },
    { uri: last, position: "last" },
  ];
}

async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractRunwayError(body: any, fallback: string): string {
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.error?.message === "string") return body.error.message;
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return body.errors.map((error: any) => error?.message ?? JSON.stringify(error)).join("; ");
  }
  return fallback;
}

async function runwayFetch(url: string, init: RequestInit, attempts = [30_000, 60_000, 120_000]): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 429 || attempts.length === 0) return res;
  await sleep(attempts[0]);
  return runwayFetch(url, init, attempts.slice(1));
}

function normalizeStatus(status: string): RunwayClipResult["status"] {
  if (status === "SUCCEEDED" || status === "succeeded" || status === "completed") return "succeeded";
  if (status === "FAILED" || status === "failed" || status === "cancelled") return "failed";
  if (status === "RUNNING" || status === "running" || status === "processing") return "running";
  return "pending";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
