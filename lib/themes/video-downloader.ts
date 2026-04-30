/**
 * lib/themes/video-downloader.ts
 *
 * Downloads a video from YouTube, Instagram, or Facebook using yt-dlp
 * for visual style analysis. Uses the lowest quality format to minimize
 * download time — only frames and audio are needed.
 */

import path from "path";
import { execSync } from "child_process";
import fs from "fs";
import { getYtdlpBin } from "./ytdlp-check";

export interface DownloadResult {
  videoPath: string;
  platform: string;
  title: string;
  durationSeconds: number;
}

// ─── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  return "unknown";
}

export function validateUrl(url: string): void {
  const platform = detectPlatform(url);
  if (platform === "unknown") {
    throw new Error(
      "Unsupported URL. Paste a link from YouTube (youtube.com/youtu.be), " +
        "Instagram (instagram.com), or Facebook (facebook.com/fb.watch)."
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format. Please paste a complete video URL.");
  }
}

// ─── Downloader ───────────────────────────────────────────────────────────────

export async function downloadForAnalysis(
  url: string,
  tempDir: string
): Promise<DownloadResult> {
  const platform = detectPlatform(url);
  const timestamp = Date.now();
  const outputTemplate = path.join(tempDir, `${timestamp}_analysis.%(ext)s`);
  const ytdlp = getYtdlpBin();

  // Use yt-dlp with lowest quality — we only need the video for frame extraction
  const infoCmd = [
    `"${ytdlp}"`,
    "--no-playlist",
    "--print", "title",
    "--print", "duration",
    "--no-download",
    `"${url}"`,
  ].join(" ");

  let title = "Untitled";
  let durationSeconds = 0;

  try {
    const infoOutput = execSync(infoCmd, { stdio: "pipe", timeout: 30_000 })
      .toString()
      .trim()
      .split("\n");
    title = infoOutput[0] ?? "Untitled";
    durationSeconds = parseFloat(infoOutput[1] ?? "0") || 0;
  } catch {
    // Non-fatal — continue with defaults
  }

  // Check duration limit (30 minutes)
  if (durationSeconds > 1800) {
    const minutes = Math.round(durationSeconds / 60);
    throw new Error(
      `This video is ${minutes} minutes long. For best results, use videos under 30 minutes. Very long videos may time out during download.`
    );
  }

  // Download using worst available quality
  const downloadCmd = [
    `"${ytdlp}"`,
    "--no-playlist",
    "--format", "worst[ext=mp4]/worst",
    "--max-filesize", "200m",
    "--output", `"${outputTemplate}"`,
    `"${url}"`,
  ].join(" ");

  try {
    execSync(downloadCmd, { stdio: "pipe", timeout: 300_000 }); // 5 minute timeout
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("Private video") || msg.includes("private")) {
      throw new Error(
        "This video is private or requires login. Only publicly accessible videos can be analyzed."
      );
    }
    if (msg.includes("not available") || msg.includes("geo")) {
      throw new Error(
        "This video is not available in your region and could not be downloaded for analysis."
      );
    }
    if (msg.includes("max-filesize") || msg.includes("too large")) {
      throw new Error(
        "This video file is too large (over 200MB) for analysis. Try a shorter video."
      );
    }
    throw new Error(
      `Could not download this video. The URL may be expired or the platform may have blocked automated access. Try downloading the video manually and uploading it as a file instead.`
    );
  }

  // Find the downloaded file
  const files = fs.readdirSync(tempDir).filter((f) =>
    f.startsWith(`${timestamp}_analysis`) && !f.endsWith(".meta.json")
  );

  if (!files.length) {
    throw new Error("Download appeared to succeed but no file was created.");
  }

  const videoPath = path.join(tempDir, files[0]);
  return { videoPath, platform, title, durationSeconds };
}
