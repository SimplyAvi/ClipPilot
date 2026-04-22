/**
 * lib/social/youtube-uploader.ts
 *
 * Uploads a video to YouTube using the YouTube Data API v3
 * with the resumable upload protocol (required for files > 5MB).
 */

import { createReadStream, statSync } from "fs";
import { getValidToken } from "./token-manager";

const YT_API = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";

// Platform limits
export const YOUTUBE_SHORTS_MAX_SEC = 60;
export const YOUTUBE_STANDARD_MAX_SEC = 43200; // 12 hours

export interface YouTubeUploadParams {
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPath?: string | null;
  categoryId: string;
  privacyStatus: "public" | "private" | "unlisted";
  madeForKids: boolean;
  containsSyntheticMedia: boolean;
  onProgress?: (percent: number) => void;
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
}

export async function uploadToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const token = await getValidToken("youtube");

  const fileStats = statSync(params.videoPath);
  const fileSize = fileStats.size;
  const contentType = "video/mp4";

  // ── Step 1: Initiate resumable upload session ──────────────────────────────
  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description: params.description.slice(0, 5000),
      tags: params.tags.slice(0, 500),
      categoryId: params.categoryId,
    },
    status: {
      privacyStatus: params.privacyStatus,
      selfDeclaredMadeForKids: params.madeForKids,
      ...(params.containsSyntheticMedia
        ? { containsSyntheticMedia: true }
        : {}),
    },
  };

  const initRes = await fetch(
    `${YT_UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Failed to initiate YouTube upload: ${text}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("YouTube did not return an upload URL");
  }

  // ── Step 2: Upload the file ────────────────────────────────────────────────
  // Use chunked upload for progress tracking (8MB chunks)
  const CHUNK_SIZE = 8 * 1024 * 1024;
  let uploadedBytes = 0;
  let videoId: string | null = null;

  while (uploadedBytes < fileSize) {
    const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, fileSize) - 1;
    const chunkSize = chunkEnd - uploadedBytes + 1;

    // Read chunk as Blob (required by fetch BodyInit typing)
    const chunkBlob = await readFileChunk(params.videoPath, uploadedBytes, chunkSize, contentType);

    const chunkRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${uploadedBytes}-${chunkEnd}/${fileSize}`,
        "Content-Length": String(chunkSize),
      },
      body: chunkBlob,
    });

    uploadedBytes = chunkEnd + 1;
    params.onProgress?.(Math.round((uploadedBytes / fileSize) * 100));

    if (chunkRes.status === 308) {
      // Resume Incomplete — continue uploading
      const rangeHeader = chunkRes.headers.get("Range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match) uploadedBytes = parseInt(match[1]) + 1;
      }
      continue;
    }

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      const json = await chunkRes.json();
      videoId = json.id;
      break;
    }

    if (!chunkRes.ok) {
      const text = await chunkRes.text();
      throw new Error(`YouTube chunk upload failed (${chunkRes.status}): ${text}`);
    }
  }

  if (!videoId) {
    throw new Error("YouTube upload completed but no video ID returned");
  }

  // ── Step 3: Set thumbnail ──────────────────────────────────────────────────
  if (params.thumbnailPath) {
    try {
      await setYouTubeThumbnail(token, videoId, params.thumbnailPath);
    } catch (err) {
      // Non-fatal — thumbnail can be set manually
      console.warn("YouTube thumbnail upload failed:", err);
    }
  }

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function setYouTubeThumbnail(
  token: string,
  videoId: string,
  thumbnailPath: string
): Promise<void> {
  const { readFileSync } = await import("fs");
  const imageBuffer = readFileSync(thumbnailPath);
  const ext = thumbnailPath.split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const imageBlob = new Blob([imageBuffer], { type: mimeType });

  const res = await fetch(
    `${YT_UPLOAD_API}/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType,
        "Content-Length": String(imageBuffer.byteLength),
      },
      body: imageBlob,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Thumbnail upload failed: ${text}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function readFileChunk(
  filePath: string,
  start: number,
  length: number,
  mimeType = "video/mp4"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end: start + length - 1 });
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(new Blob([Buffer.concat(chunks)], { type: mimeType })));
    stream.on("error", reject);
  });
}

/**
 * Returns the YouTube channel info for the authenticated user.
 * Used after OAuth connect to save the username.
 */
export async function getYouTubeChannelInfo(
  accessToken: string
): Promise<{ channelId: string; title: string }> {
  const res = await fetch(
    `${YT_API}/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch YouTube channel info");
  const json = await res.json();
  const channel = json.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this account");
  return { channelId: channel.id, title: channel.snippet.title };
}
