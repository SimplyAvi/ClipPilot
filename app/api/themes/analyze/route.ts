/**
 * POST /api/themes/analyze
 *
 * Orchestrates the full theme analysis pipeline via Server-Sent Events.
 * Accepts: { url: string } or multipart form with a video file upload.
 *
 * SSE events:
 *   event: status — { step, message, progress }
 *   event: complete — { themeData, framePaths }
 *   event: error — { message }
 */

import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { checkYtdlp } from "@/lib/themes/ytdlp-check";
import { validateUrl, detectPlatform, downloadForAnalysis } from "@/lib/themes/video-downloader";
import { extractAnalysisFrames } from "@/lib/themes/frame-extractor";
import { extractColorPalette } from "@/lib/themes/color-extractor";
import { analyzeFramesWithClaude } from "@/lib/themes/vision-analyzer";
import { cleanupAnalysisTemp, deleteFile } from "@/lib/themes/cleanup";
import { getLocalStoragePath } from "@/lib/storage";

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown
) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

function sendStatus(
  controller: ReadableStreamDefaultController,
  step: string,
  message: string,
  progress: number
) {
  sseEvent(controller, "status", { step, message, progress });
}

// ─── Frame copy to permanent theme storage ────────────────────────────────────

async function copyFramesToPermanentStorage(
  framePaths: string[],
  themeId: string,
  storageRoot: string
): Promise<string[]> {
  const themeFrameDir = path.join(storageRoot, "themes", themeId);
  fs.mkdirSync(themeFrameDir, { recursive: true });

  // Copy up to 6 best frames (evenly spaced)
  const toSave = framePaths.length <= 6
    ? framePaths
    : framePaths.filter((_, i) => {
        const step = (framePaths.length - 1) / 5;
        return [0, 1, 2, 3, 4, 5].some((j) => Math.round(j * step) === i);
      });

  const savedPaths: string[] = [];
  for (let i = 0; i < toSave.length; i++) {
    const dest = path.join(themeFrameDir, `frame_${String(i + 1).padStart(3, "0")}.jpg`);
    fs.copyFileSync(toSave[i], dest);
    savedPaths.push(dest);
  }
  return savedPaths;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const tempBaseDir = path.join(
        await getLocalStoragePath(),
        "_theme_analysis"
      );
      const sessionId = Date.now().toString();
      const sessionDir = path.join(tempBaseDir, sessionId);
      let downloadedVideoPath: string | null = null;

      try {
        // Parse request
        let url: string | null = null;
        let uploadedVideoPath: string | null = null;
        let platform = "unknown";
        let durationSeconds = 0;

        const contentType = req.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const body = await req.json();
          url = body.url ?? null;
        } else if (contentType.includes("multipart/form-data")) {
          const form = await req.formData();
          const file = form.get("file") as File | null;
          if (file) {
            // Save uploaded file to temp
            fs.mkdirSync(sessionDir, { recursive: true });
            const uploadPath = path.join(sessionDir, "uploaded_video.mp4");
            const buffer = Buffer.from(await file.arrayBuffer());
            fs.writeFileSync(uploadPath, buffer);
            uploadedVideoPath = uploadPath;
            platform = "upload";
          }
        }

        // ── Step 1: Validate and download (if URL) ──
        if (url) {
          sendStatus(controller, "validating", "Validating URL…", 5);
          validateUrl(url);
          platform = detectPlatform(url);

          // Check yt-dlp
          const ytdlp = checkYtdlp();
          if (!ytdlp.available) {
            sseEvent(controller, "error", {
              message:
                "yt-dlp is not installed. Please install it and try again.\n" +
                "macOS: brew install yt-dlp\n" +
                "Windows: winget install yt-dlp\n" +
                "Manual: https://github.com/yt-dlp/yt-dlp",
              ytdlpMissing: true,
            });
            controller.close();
            return;
          }

          sendStatus(controller, "downloading", "Downloading video for analysis…", 10);
          fs.mkdirSync(sessionDir, { recursive: true });
          const downloaded = await downloadForAnalysis(url, sessionDir);
          downloadedVideoPath = downloaded.videoPath;
          durationSeconds = downloaded.durationSeconds;
        } else if (uploadedVideoPath) {
          sendStatus(controller, "processing", "Processing uploaded video…", 10);
          downloadedVideoPath = uploadedVideoPath;
          // Estimate duration later — we'll rely on FFmpeg
        } else {
          sseEvent(controller, "error", { message: "No URL or file provided." });
          controller.close();
          return;
        }

        // ── Step 2: Extract frames ──
        sendStatus(controller, "extracting_frames", "Extracting frames…", 30);
        const frameOutputDir = path.join(sessionDir, "frames");
        const { framePaths } = await extractAnalysisFrames(
          downloadedVideoPath,
          durationSeconds || 60,
          frameOutputDir
        );

        // Delete the downloaded video immediately (keep only frames)
        if (downloadedVideoPath && downloadedVideoPath !== uploadedVideoPath) {
          deleteFile(downloadedVideoPath);
          downloadedVideoPath = null;
        }

        // ── Step 3: Extract color palette ──
        sendStatus(controller, "analyzing_colors", "Reading color palette…", 50);
        const colorData = await extractColorPalette(framePaths);

        // ── Step 4: Analyze with Claude vision ──
        sendStatus(controller, "analyzing_style", "Analyzing visual style with AI…", 70);
        const analysisResult = await analyzeFramesWithClaude(framePaths, colorData);

        // ── Step 5: Copy frames to permanent storage ──
        sendStatus(controller, "building_theme", "Building your theme…", 85);
        const storageRoot = await getLocalStoragePath();
        const themeId = `theme-${sessionId}`;
        const permanentFramePaths = await copyFramesToPermanentStorage(
          framePaths,
          themeId,
          storageRoot
        );

        // ── Step 6: Send complete event ──
        sendStatus(controller, "cleaning_up", "Cleaning up temporary files…", 95);

        sseEvent(controller, "complete", {
          themeData: {
            ...analysisResult,
            colorPalette: colorData.dominantColors,
            colorMood: colorData.colorMood,
            colorTemperature: colorData.colorTemperature,
            saturation: colorData.saturation,
            contrast: colorData.contrast,
            referenceFramePaths: permanentFramePaths,
            sourceUrl: url,
            sourcePlatform: platform,
            analysisRawJson: JSON.stringify(analysisResult),
          },
        });

        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error during analysis.";
        sseEvent(controller, "error", { message });
        controller.close();
      } finally {
        // Always clean up temp files older than 1 hour
        const tempBase = path.join(
          await getLocalStoragePath(),
          "_theme_analysis"
        );
        await cleanupAnalysisTemp(tempBase).catch(() => undefined);

        // Delete uploaded video if still present
        if (downloadedVideoPath) {
          deleteFile(downloadedVideoPath);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
