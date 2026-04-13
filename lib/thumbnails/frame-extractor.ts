/**
 * lib/thumbnails/frame-extractor.ts — Phase 10
 *
 * FFmpeg-based frame extraction from rendered video files.
 * Used to pull candidate frames for thumbnail generation.
 */

import path from "path";
import os from "os";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import Anthropic from "@anthropic-ai/sdk";
import { getProviderKey } from "@/lib/provider-keys";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Returns the duration of a video in seconds. */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });
}

// ─── extractFrames ─────────────────────────────────────────────────────────────

/**
 * Extract {count} evenly-spaced JPG frames from a local video file.
 * Returns an array of absolute file paths to the extracted JPGs.
 * The caller is responsible for cleaning up the returned files.
 */
export async function extractFrames(
  videoPath: string,
  count: number
): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);
  if (duration <= 0) throw new Error("Video has zero duration");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cp-frames-"));
  const framePaths: string[] = [];

  // Evenly-spaced timestamps: step into the video by duration/(count+1)
  const step = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const timestamp = step * i;
    const framePath = path.join(tmpDir, `frame-${String(i).padStart(2, "0")}.jpg`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .outputOptions(["-vf", "scale=1280:-1", "-q:v", "2"])
        .output(framePath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    framePaths.push(framePath);
  }

  return framePaths;
}

// ─── extractBestFrame ─────────────────────────────────────────────────────────

/**
 * Extract 10 frames then ask Claude Vision to pick the best thumbnail frame.
 * Returns the absolute file path of the winning frame.
 * Falls back to the first frame if vision fails.
 */
export async function extractBestFrame(videoPath: string): Promise<string> {
  const frames = await extractFrames(videoPath, 10);

  const apiKey = await getProviderKey("anthropic");
  if (!apiKey || frames.length === 0) return frames[0] ?? videoPath;

  try {
    const client = new Anthropic({ apiKey });

    // Read all frames as base64
    const imageContents = await Promise.all(
      frames.map(async (fp) => {
        const data = await fs.readFile(fp);
        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/jpeg" as const,
            data: data.toString("base64"),
          },
        };
      })
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text",
              text:
                "These are frames from a short-form social media video. " +
                "Identify the single frame most likely to work as a compelling thumbnail. " +
                "Consider: visual clarity, emotional impact, composition, " +
                "and whether the frame is intriguing without being clickbait. " +
                "Return the frame number (1-10) as a plain integer only.",
            },
          ],
        },
      ],
    });

    const raw = response.content[0];
    if (raw.type === "text") {
      const num = parseInt(raw.text.trim(), 10);
      if (num >= 1 && num <= frames.length) {
        return frames[num - 1];
      }
    }
  } catch {
    // Fall through to default
  }

  return frames[0];
}
