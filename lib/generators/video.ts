/**
 * Shot video generation.
 *
 * Primary provider: Runway ML Gen-3 Alpha Turbo (text-to-video)
 * Fallback provider: Replicate (zeroscope-v2-xl)
 *
 * Every prompt gets the compliance guardrail block appended automatically.
 * After generation, the video is uploaded to Cloudflare R2.
 */

import { storage } from "@/lib/storage";
import { shotPath, slugify } from "@/lib/storage/naming";
import { appendGenerationLog } from "@/lib/storage/generation-log";
import { recordRunwayCost } from "@/lib/analytics/cost-tracker";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterRef {
  name: string;
  description: string | null;
}

export interface ShotConfig {
  shotId: string;
  shotNumber: number;
  /** wide | medium | close-up | insert */
  shotType: string;
  /** seconds */
  duration: number;
  /** narrative description from script beat */
  description: string;
  location: string;
  timeOfDay: string;
  emotionalTone: string;
  characters: CharacterRef[];
  /** cinematic motion guidance */
  cameraMovement?: string;
  lighting?: string;
}

export interface GenerationResult {
  r2Key: string;
  backend: "local" | "r2";
  provider: "runway" | "replicate";
  durationSec: number;
  costUsd: number;
}

// ─── Compliance guardrails ────────────────────────────────────────────────────

const COMPLIANCE_GUARDRAILS = [
  "No logos, no brand marks, no text visible anywhere in the frame.",
  "Entirely fictional characters, not resembling any real, living, or deceased person.",
  "No copyrighted characters, trademarked imagery, or identifiable intellectual property.",
  "No real-world landmarks that could create legal association.",
  "No weapons, violence, or content inappropriate for general audiences.",
].join(" ");

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildShotPrompt(shot: ShotConfig): string {
  const parts: string[] = [];

  // Shot framing
  const framingMap: Record<string, string> = {
    wide: "Wide establishing shot",
    medium: "Medium shot",
    "close-up": "Close-up shot",
    insert: "Insert / detail shot",
  };
  parts.push(framingMap[shot.shotType] ?? "Shot");

  // Location and time
  parts.push(`set in ${shot.location}, ${shot.timeOfDay.toLowerCase()}.`);

  // Characters
  if (shot.characters.length > 0) {
    const charDesc = shot.characters
      .map((c) => {
        const base = `fictional character ${c.name}`;
        return c.description ? `${base} (${c.description})` : base;
      })
      .join(", ");
    parts.push(`Featuring ${charDesc}.`);
  }

  // Scene beat description
  parts.push(shot.description);

  // Mood and lighting
  parts.push(`Emotional tone: ${shot.emotionalTone}.`);
  if (shot.lighting) parts.push(`Lighting: ${shot.lighting}.`);

  // Camera movement
  if (shot.cameraMovement) {
    parts.push(`Camera: ${shot.cameraMovement}.`);
  } else {
    const defaultMovement: Record<string, string> = {
      wide: "slow dolly-in",
      medium: "subtle pan",
      "close-up": "static with shallow depth of field",
      insert: "static macro",
    };
    const movement = defaultMovement[shot.shotType] ?? "static";
    parts.push(`Camera: ${movement}.`);
  }

  // Cinematic quality
  parts.push("Cinematic, 4K quality, professional color grading.");

  // Compliance guardrails always last
  parts.push(COMPLIANCE_GUARDRAILS);

  return parts.join(" ");
}

// ─── Runway ML Gen-3 provider ─────────────────────────────────────────────────

const RUNWAY_API_BASE = "https://api.runwayml.com/v1";
// Runway Gen-3 Alpha Turbo: ~$0.05/second
const RUNWAY_COST_PER_SECOND = 0.05;
// Max poll attempts × interval = 10 minutes timeout
const RUNWAY_POLL_ATTEMPTS = 120;
const RUNWAY_POLL_INTERVAL_MS = 5_000;

interface RunwayTask {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  output?: string[];
  failure?: string;
  failureCode?: string;
}

async function runwayGenerate(prompt: string, durationSec: number): Promise<Buffer> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

  // Create task
  const createRes = await fetch(`${RUNWAY_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      taskType: "textToVideo",
      model: "gen3a_turbo",
      inputs: {
        text_prompt: prompt,
        duration: durationSec <= 5 ? 5 : 10,
        ratio: "1280:768",
        seed: Math.floor(Math.random() * 4_294_967_295),
        watermark: false,
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Runway task creation failed ${createRes.status}: ${body}`);
  }

  const task: RunwayTask = await createRes.json();
  const taskId = task.id;

  // Poll until complete
  for (let attempt = 0; attempt < RUNWAY_POLL_ATTEMPTS; attempt++) {
    await sleep(RUNWAY_POLL_INTERVAL_MS);

    const pollRes = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });

    if (!pollRes.ok) {
      throw new Error(`Runway poll failed ${pollRes.status}`);
    }

    const polled: RunwayTask = await pollRes.json();

    if (polled.status === "SUCCEEDED") {
      const videoUrl = polled.output?.[0];
      if (!videoUrl) throw new Error("Runway returned no output URL");
      return downloadUrl(videoUrl);
    }

    if (polled.status === "FAILED" || polled.status === "CANCELLED") {
      throw new Error(
        `Runway task ${polled.status}: ${polled.failure ?? "unknown"} (${polled.failureCode ?? ""})`
      );
    }
    // PENDING or RUNNING — keep polling
  }

  throw new Error("Runway task timed out after 10 minutes");
}

// ─── Replicate fallback provider ──────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
// zeroscope-v2-xl — cost roughly $0.023/run, fixed duration
const REPLICATE_COST_FLAT = 0.023;
// Model version for zeroscope-v2-xl (576×320, good for short clips)
const ZEROSCOPE_VERSION = "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
}

async function replicateGenerate(prompt: string, durationSec: number): Promise<Buffer> {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY is not configured");

  const numFrames = Math.min(Math.round(durationSec * 8), 64); // 8fps, max 64 frames (~8s)

  const createRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: ZEROSCOPE_VERSION,
      input: {
        prompt,
        negative_prompt:
          "text, watermark, logo, brand, ugly, blurry, low quality, real person, celebrity",
        num_frames: numFrames,
        fps: 8,
        width: 576,
        height: 320,
        num_inference_steps: 40,
        guidance_scale: 17.5,
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Replicate prediction creation failed ${createRes.status}: ${body}`);
  }

  const prediction: ReplicatePrediction = await createRes.json();

  // Poll until complete
  for (let attempt = 0; attempt < 180; attempt++) {
    await sleep(3_000);

    const pollRes = await fetch(`${REPLICATE_API_BASE}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) throw new Error(`Replicate poll failed ${pollRes.status}`);

    const polled: ReplicatePrediction = await pollRes.json();

    if (polled.status === "succeeded") {
      const output = polled.output;
      const videoUrl = Array.isArray(output) ? output[0] : output;
      if (!videoUrl) throw new Error("Replicate returned no output");
      return downloadUrl(videoUrl);
    }

    if (polled.status === "failed" || polled.status === "canceled") {
      throw new Error(`Replicate prediction ${polled.status}: ${polled.error ?? "unknown"}`);
    }
  }

  throw new Error("Replicate prediction timed out after 9 minutes");
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate a video shot, upload to R2, return the R2 key and cost.
 *
 * Tries Runway first; falls back to Replicate if Runway key is absent
 * or if Runway throws. If both fail the error from the last attempt is thrown.
 */
export async function generateShot(
  projectId: string,
  sceneId: string,
  shot: ShotConfig
): Promise<GenerationResult> {
  const prompt = buildShotPrompt(shot);
  console.log(`[video] Generating shot ${shot.shotNumber} — prompt:\n${prompt}`);

  let videoBuffer: Buffer;
  let provider: "runway" | "replicate";
  let costUsd: number;

  // ── Try Runway first ──
  if (process.env.RUNWAY_API_KEY) {
    try {
      videoBuffer = await runwayGenerate(prompt, shot.duration);
      provider = "runway";
      costUsd = shot.duration * RUNWAY_COST_PER_SECOND;
    } catch (err) {
      console.warn(
        `[video] Runway failed for shot ${shot.shotNumber}, falling back to Replicate:`,
        err instanceof Error ? err.message : err
      );
      videoBuffer = await replicateGenerate(prompt, shot.duration);
      provider = "replicate";
      costUsd = REPLICATE_COST_FLAT;
    }
  } else {
    // ── No Runway key — go straight to Replicate ──
    videoBuffer = await replicateGenerate(prompt, shot.duration);
    provider = "replicate";
    costUsd = REPLICATE_COST_FLAT;
  }

  const scene = await db.scene.findUnique({
    where: { id: sceneId },
    include: { project: { select: { id: true, projectSlug: true, name: true } } },
  });
  const projectSlug = scene?.project.projectSlug ?? slugify(scene?.project.name ?? projectId);
  const characterSlug = slugify(shot.characters[0]?.name ?? "scene");
  const filePath = shotPath(
    projectSlug,
    scene?.sceneNumber ?? 1,
    shot.shotNumber,
    shot.shotNumber,
    shot.shotType,
    characterSlug,
    1
  );
  const stored = await storage.save(filePath, videoBuffer, "video/mp4", {
    projectId,
    sceneId,
    shotId: shot.shotId,
    generatedBy: provider,
    model: provider === "runway" ? "gen3" : "replicate-fallback",
  });

  // Record cost (fire-and-forget — never blocks generation)
  if (provider === "runway") {
    void recordRunwayCost(projectId, shot.duration);
  }

  console.log(
    `[video] Shot ${shot.shotNumber} complete — provider=${provider} cost=$${costUsd.toFixed(3)} key=${stored.path}`
  );

  await appendGenerationLog(projectSlug, {
    timestamp: new Date().toISOString(),
    type: "video",
    provider,
    model: provider === "runway" ? "gen3" : "replicate-fallback",
    outputPath: stored.path,
    durationSeconds: shot.duration,
    cost: costUsd,
    status: "success",
  }).catch(() => undefined);

  return { r2Key: stored.path, backend: stored.backend, provider, durationSec: shot.duration, costUsd };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video: HTTP ${res.status} from ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
