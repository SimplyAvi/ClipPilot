/**
 * Likeness compliance check.
 *
 * Accepts a video file buffer, extracts a representative frame, then calls
 * the configured facial recognition provider to check for resemblance to
 * known public figures.
 *
 * Provider: AWS Rekognition `RecognizeCelebrities` (requires AWS credentials +
 * rekognition:RecognizeCelebrities permission).
 *
 * When LIKENESS_CHECK_ENABLED is not "true" or credentials are absent, the
 * check returns "passed" with a warning log — the pipeline still runs, but
 * results are logged as unverified. This is intentional: you must explicitly
 * opt-in to likeness checking.
 *
 * DB logging: every check result is written to the Shot record by the caller
 * (scene-generation.worker.ts) — this module only returns the result.
 */

import { RekognitionClient, RecognizeCelebritiesCommand } from "@aws-sdk/client-rekognition";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LikenessResult =
  | { outcome: "passed"; score: null; matchedName: null }
  | { outcome: "flagged"; score: number; matchedName: string; reason: string }
  | { outcome: "skipped"; reason: string };

// ─── Client ───────────────────────────────────────────────────────────────────

function createRekognitionClient(): RekognitionClient | null {
  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.LIKENESS_CHECK_ENABLED !== "true"
  ) {
    return null;
  }

  return new RekognitionClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// ─── Frame extraction ─────────────────────────────────────────────────────────

/**
 * Extract a JPEG frame from an MP4 buffer using ffmpeg (if available).
 * Falls back to returning the first 500KB of the buffer treated as an image
 * if ffmpeg is not present — Rekognition will reject non-images and the check
 * will be marked as skipped.
 */
async function extractFrameFromVideo(videoBuffer: Buffer): Promise<Buffer> {
  try {
    const ffmpeg = await import("child_process");
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs/promises");

    const tmpDir = os.default.tmpdir();
    const inputPath = path.default.join(tmpDir, `clip-${Date.now()}.mp4`);
    const outputPath = path.default.join(tmpDir, `frame-${Date.now()}.jpg`);

    await fs.default.writeFile(inputPath, videoBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = ffmpeg.default.spawn("ffmpeg", [
        "-i", inputPath,
        "-ss", "00:00:01",  // 1 second in — avoids black frames
        "-frames:v", "1",
        "-q:v", "2",
        outputPath,
        "-y",
        "-loglevel", "error",
      ]);
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    });

    const frameBuffer = await fs.default.readFile(outputPath);

    // Cleanup temp files
    await Promise.allSettled([
      fs.default.unlink(inputPath),
      fs.default.unlink(outputPath),
    ]);

    return frameBuffer;
  } catch {
    // ffmpeg not available or failed — return a slice of the buffer
    // Rekognition will reject it and we mark the check as skipped
    return videoBuffer.slice(0, Math.min(videoBuffer.length, 500_000));
  }
}

// ─── Rekognition check ────────────────────────────────────────────────────────

const LIKENESS_THRESHOLD = 0.85; // 85% similarity considered a match

async function checkWithRekognition(
  client: RekognitionClient,
  imageBuffer: Buffer
): Promise<LikenessResult> {
  const command = new RecognizeCelebritiesCommand({
    Image: { Bytes: imageBuffer },
  });

  const response = await client.send(command);
  const celebrities = response.CelebrityFaces ?? [];

  // Find the highest-confidence match
  const topMatch = celebrities
    .filter((c) => (c.MatchConfidence ?? 0) / 100 >= LIKENESS_THRESHOLD)
    .sort((a, b) => (b.MatchConfidence ?? 0) - (a.MatchConfidence ?? 0))[0];

  if (!topMatch) {
    return { outcome: "passed", score: null, matchedName: null };
  }

  const score = (topMatch.MatchConfidence ?? 0) / 100;
  const name = topMatch.Name ?? "Unknown";

  return {
    outcome: "flagged",
    score,
    matchedName: name,
    reason: `Detected resemblance to ${name} (${(score * 100).toFixed(1)}% confidence). Shot must be reviewed before export.`,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run a likeness check against the provided video buffer.
 *
 * @param videoBuffer  Raw MP4 bytes of the generated shot
 * @param shotId       Used only for logging
 */
export async function checkLikeness(
  videoBuffer: Buffer,
  shotId: string
): Promise<LikenessResult> {
  const client = createRekognitionClient();

  if (!client) {
    const reason =
      process.env.LIKENESS_CHECK_ENABLED !== "true"
        ? "LIKENESS_CHECK_ENABLED is not set to 'true'"
        : "AWS credentials not configured";

    console.warn(`[likeness] Check skipped for shot ${shotId}: ${reason}`);
    return { outcome: "skipped", reason };
  }

  try {
    console.log(`[likeness] Checking shot ${shotId}…`);
    const frame = await extractFrameFromVideo(videoBuffer);
    const result = await checkWithRekognition(client, frame);

    if (result.outcome === "flagged") {
      console.warn(
        `[likeness] Shot ${shotId} FLAGGED — ${result.matchedName} @ ${(result.score * 100).toFixed(1)}%`
      );
    } else {
      console.log(`[likeness] Shot ${shotId} passed`);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[likeness] Check failed for shot ${shotId}:`, message);
    // Return skipped rather than crashing the worker
    return { outcome: "skipped", reason: `Check error: ${message}` };
  }
}

export async function checkImageLikeness(
  imageBuffer: Buffer,
  label: string
): Promise<LikenessResult> {
  const client = createRekognitionClient();

  if (!client) {
    const reason =
      process.env.LIKENESS_CHECK_ENABLED !== "true"
        ? "LIKENESS_CHECK_ENABLED is not set to 'true'"
        : "AWS credentials not configured";

    console.warn(`[likeness] Image check skipped for ${label}: ${reason}`);
    return { outcome: "skipped", reason };
  }

  try {
    console.log(`[likeness] Checking image ${label}...`);
    return await checkWithRekognition(client, imageBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[likeness] Image check failed for ${label}:`, message);
    return { outcome: "skipped", reason: `Check error: ${message}` };
  }
}
