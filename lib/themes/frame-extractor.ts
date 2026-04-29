/**
 * lib/themes/frame-extractor.ts
 *
 * Extracts representative frames from a video for style analysis.
 * Uses FFmpeg to extract frames at calculated intervals.
 * Also extracts a 30-second audio sample for mood reference.
 *
 * Uses dynamic require() for fluent-ffmpeg and @ffmpeg-installer/ffmpeg
 * to avoid Next.js bundler issues — same pattern as audio-mix.ts.
 */

import path from "path";
import fs from "fs";

// ─── FFmpeg loader (dynamic require, avoids bundler issues) ──────────────────

function loadFfmpeg() {
  const mod: unknown = require("fluent-ffmpeg");
  const ffmpeg: unknown =
    typeof mod === "function" ? mod : (mod as Record<string, unknown>).default ?? mod;

  // Binary: FFMPEG_PATH env > @ffmpeg-installer > system
  let binPath: string | undefined = process.env.FFMPEG_PATH;
  if (!binPath) {
    try {
      binPath = (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
    } catch {
      // System ffmpeg will be used
    }
  }

  const ff = ffmpeg as {
    setFfmpegPath?: (p: string) => void;
    (input: string): FfmpegCommand;
  };

  if (binPath && typeof ff.setFfmpegPath === "function") {
    ff.setFfmpegPath(binPath);
  }

  return ff;
}

interface FfmpegCommand {
  outputOptions(opts: string[]): FfmpegCommand;
  output(p: string): FfmpegCommand;
  on(event: "end", cb: () => void): FfmpegCommand;
  on(event: "error", cb: (err: Error) => void): FfmpegCommand;
  run(): void;
}

// ─── Frame count strategy ─────────────────────────────────────────────────────

function frameCountForDuration(durationSeconds: number): number {
  if (durationSeconds < 60) return 8;
  if (durationSeconds < 180) return 12;
  return 16;
}

// ─── Frame extraction ─────────────────────────────────────────────────────────

export interface FrameExtractionResult {
  framePaths: string[];
  audioSamplePath: string | null;
}

export async function extractAnalysisFrames(
  videoPath: string,
  durationSeconds: number,
  outputDir: string
): Promise<FrameExtractionResult> {
  fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = loadFfmpeg();
  const count = frameCountForDuration(durationSeconds);

  // For long videos, skip first/last 5% (intros/outros are unrepresentative)
  const skipStart = durationSeconds > 180 ? durationSeconds * 0.05 : 0;
  const skipEnd = durationSeconds > 180 ? durationSeconds * 0.95 : durationSeconds;
  const effectiveDuration = skipEnd - skipStart;
  const interval = effectiveDuration / (count + 1);

  // Build timestamps for frame extraction
  const timestamps: number[] = Array.from(
    { length: count },
    (_, i) => skipStart + interval * (i + 1)
  );

  // Build pts-based select filter
  const selectExpr = timestamps
    .map((t) => `between(t,${t.toFixed(2)},${(t + 0.15).toFixed(2)})`)
    .join("+");

  const frameOutputPattern = path.join(outputDir, "frame_%03d.jpg");

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf select='${selectExpr}',scale=768:-1,setpts=N/FRAME_RATE/TB`,
        `-vsync vfr`,
        `-frames:v ${count}`,
        `-q:v 2`,
      ])
      .output(frameOutputPattern)
      .on("end", () => resolve())
      .on("error", (err: Error) =>
        reject(new Error(`Frame extraction failed: ${err.message}`))
      )
      .run();
  });

  // Collect extracted frame paths (sorted)
  const framePaths = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(outputDir, f));

  if (framePaths.length < 4) {
    throw new Error(
      "Not enough frames extracted for analysis. The video may be too short (under 10 seconds)."
    );
  }

  // Extract 30-second audio sample (non-fatal)
  const audioSamplePath = path.join(outputDir, "audio_sample.wav");
  let extractedAudio: string | null = null;

  try {
    await new Promise<void>((resolve) => {
      ffmpeg(videoPath)
        .outputOptions(["-t", "30", "-vn", "-ar", "44100"])
        .output(audioSamplePath)
        .on("end", () => resolve())
        .on("error", () => resolve())
        .run();
    });
    if (fs.existsSync(audioSamplePath)) {
      extractedAudio = audioSamplePath;
    }
  } catch {
    // Audio extraction is non-fatal
  }

  return { framePaths, audioSamplePath: extractedAudio };
}
