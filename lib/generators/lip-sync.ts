/**
 * Lip sync alignment via Sync Labs API (https://sync.so).
 *
 * Accepts a generated video and a dialogue audio file (both R2 keys).
 * Generates short-lived signed URLs, submits to Sync Labs, polls for
 * completion, downloads the lip-synced video, uploads back to R2.
 *
 * When SYNC_LABS_API_KEY is absent the function returns status="SKIPPED"
 * so the pipeline continues without lip sync.
 */

import { getSignedViewUrl, uploadToR2 } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LipSyncStatus = "COMPLETE" | "FAILED" | "SKIPPED";

export interface LipSyncResult {
  status: LipSyncStatus;
  r2Key: string | null;
  error?: string;
}

// ─── Sync Labs API ────────────────────────────────────────────────────────────

const SYNC_LABS_BASE = "https://api.sync.so/v2";
const POLL_ATTEMPTS = 60;   // 60 × 5 s = 5-minute timeout
const POLL_INTERVAL_MS = 5_000;

interface SyncLabsJob {
  id: string;
  status: "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run lip sync on a single shot.
 *
 * @param projectId  Used to build the R2 output key
 * @param sceneId    Used to build the R2 output key
 * @param shotId     Used to build the R2 output key
 * @param videoR2Key R2 key of the generated (non-lip-synced) video
 * @param audioR2Key R2 key of the mixed dialogue audio
 */
export async function lipSyncShot(
  projectId: string,
  sceneId: string,
  shotId: string,
  videoR2Key: string,
  audioR2Key: string
): Promise<LipSyncResult> {
  const apiKey = process.env.SYNC_LABS_API_KEY;
  if (!apiKey) {
    console.warn(`[lip-sync] Shot ${shotId}: SYNC_LABS_API_KEY not set — skipping`);
    return { status: "SKIPPED", r2Key: null, error: "SYNC_LABS_API_KEY not configured" };
  }

  // Generate signed URLs so Sync Labs can fetch the files from R2
  let videoUrl: string;
  let audioUrl: string;
  try {
    [videoUrl, audioUrl] = await Promise.all([
      getSignedViewUrl(videoR2Key, 7200),
      getSignedViewUrl(audioR2Key, 7200),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "FAILED", r2Key: null, error: `Signed URL generation failed: ${msg}` };
  }

  // Submit job to Sync Labs
  let jobId: string;
  try {
    const res = await fetch(`${SYNC_LABS_BASE}/generate`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "lipsync-1.9.0-beta",
        input: [
          { type: "video", url: videoUrl },
          { type: "audio", url: audioUrl },
        ],
        options: { output_format: "mp4", sync_mode: "bounce" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        status: "FAILED",
        r2Key: null,
        error: `Sync Labs create failed ${res.status}: ${body}`,
      };
    }

    const job: SyncLabsJob = await res.json();
    jobId = job.id;
    console.log(`[lip-sync] Shot ${shotId} — submitted job ${jobId}`);
  } catch (err) {
    return {
      status: "FAILED",
      r2Key: null,
      error: `Sync Labs request error: ${err instanceof Error ? err.message : err}`,
    };
  }

  // Poll until complete
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const res = await fetch(`${SYNC_LABS_BASE}/generate/${jobId}`, {
        headers: { "x-api-key": apiKey },
      });

      if (!res.ok) {
        console.warn(`[lip-sync] Poll attempt ${attempt} failed: HTTP ${res.status}`);
        continue;
      }

      const job: SyncLabsJob = await res.json();

      if (job.status === "completed") {
        if (!job.outputUrl) {
          return { status: "FAILED", r2Key: null, error: "Sync Labs returned no output URL" };
        }

        // Download the result
        const dlRes = await fetch(job.outputUrl);
        if (!dlRes.ok) {
          return {
            status: "FAILED",
            r2Key: null,
            error: `Failed to download lip-synced video: HTTP ${dlRes.status}`,
          };
        }

        const buffer = Buffer.from(await dlRes.arrayBuffer());
        const r2Key = `projects/${projectId}/scenes/${sceneId}/shots/${shotId}/lipsync.mp4`;
        await uploadToR2(r2Key, buffer, "video/mp4");

        console.log(`[lip-sync] Shot ${shotId} complete — ${r2Key}`);
        return { status: "COMPLETE", r2Key };
      }

      if (job.status === "failed") {
        return {
          status: "FAILED",
          r2Key: null,
          error: `Sync Labs job failed: ${job.error ?? "unknown"}`,
        };
      }

      console.log(`[lip-sync] Shot ${shotId} — attempt ${attempt + 1}: still processing`);
    } catch (err) {
      console.warn(`[lip-sync] Poll error (attempt ${attempt}):`, err);
    }
  }

  return { status: "FAILED", r2Key: null, error: "Lip sync timed out after 5 minutes" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
