/**
 * lib/social/tiktok-uploader.ts
 *
 * Uploads a video to TikTok using the TikTok Content Posting API v2.
 * Uses the PULL_FROM_URL source when a public URL is available,
 * falling back to FILE_UPLOAD with chunked transfer.
 */

import { statSync } from "fs";
import { getValidToken } from "./token-manager";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

// Platform limits
export const TIKTOK_MAX_SEC = 600; // 10 minutes

export type TikTokPrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "SELF_ONLY";

export interface TikTokUploadParams {
  videoPath: string;
  publicVideoUrl?: string | null; // R2 signed URL (if publicly accessible)
  caption: string;
  hashtags: string[];
  privacyLevel: TikTokPrivacyLevel;
  disableDuet: boolean;
  disableStitch: boolean;
  disableComment: boolean;
  onProgress?: (percent: number) => void;
}

export interface TikTokUploadResult {
  publishId: string;
  shareUrl: string;
}

export async function uploadToTikTok(
  params: TikTokUploadParams
): Promise<TikTokUploadResult> {
  const token = await getValidToken("tiktok");

  const fullCaption = buildCaption(params.caption, params.hashtags);

  // Use URL-based upload if a public URL is available
  if (params.publicVideoUrl) {
    return uploadViaPullUrl(token, params.publicVideoUrl, fullCaption, params);
  }

  // Otherwise fall back to direct file upload
  return uploadViaFile(token, params.videoPath, fullCaption, params);
}

async function uploadViaPullUrl(
  token: string,
  videoUrl: string,
  caption: string,
  params: TikTokUploadParams
): Promise<TikTokUploadResult> {
  const body = {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: params.privacyLevel,
      disable_duet: params.disableDuet,
      disable_comment: params.disableComment,
      disable_stitch: params.disableStitch,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };

  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    // Check for rate limit
    if (initRes.status === 429) {
      const retryAfter = initRes.headers.get("Retry-After") ?? "60";
      throw new Error(
        `Too many uploads — TikTok requires waiting ${retryAfter} seconds between uploads.`
      );
    }
    throw new Error(`TikTok upload init failed: ${text}`);
  }

  const json = await initRes.json();
  const publishId: string = json.data?.publish_id;
  if (!publishId) throw new Error("TikTok did not return a publish_id");

  // Poll for publish status
  params.onProgress?.(50);
  const shareUrl = await pollTikTokStatus(token, publishId, params.onProgress);
  return { publishId, shareUrl };
}

async function uploadViaFile(
  token: string,
  videoPath: string,
  caption: string,
  params: TikTokUploadParams
): Promise<TikTokUploadResult> {
  const fileStats = statSync(videoPath);
  const fileSize = fileStats.size;
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  // Step 1: Init upload
  const initBody = {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: params.privacyLevel,
      disable_duet: params.disableDuet,
      disable_comment: params.disableComment,
      disable_stitch: params.disableStitch,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: fileSize,
      chunk_size: CHUNK_SIZE,
      total_chunk_count: totalChunks,
    },
  };

  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(initBody),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    if (initRes.status === 429) {
      const retryAfter = initRes.headers.get("Retry-After") ?? "60";
      throw new Error(
        `Too many uploads — TikTok requires waiting ${retryAfter} seconds between uploads.`
      );
    }
    throw new Error(`TikTok upload init failed: ${text}`);
  }

  const initJson = await initRes.json();
  const publishId: string = initJson.data?.publish_id;
  const uploadUrl: string = initJson.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error("TikTok did not return publish_id or upload_url");
  }

  // Step 2: Upload chunks
  const { createReadStream } = await import("fs");
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize) - 1;
    const chunkActualSize = end - start + 1;

    const chunkBlob = await new Promise<Blob>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(videoPath, { start, end });
      stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on("end", () => resolve(new Blob([Buffer.concat(chunks)], { type: "video/mp4" })));
      stream.on("error", reject);
    });

    const chunkRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(chunkActualSize),
        "Content-Type": "video/mp4",
      },
      body: chunkBlob,
    });

    if (!chunkRes.ok && chunkRes.status !== 206) {
      const text = await chunkRes.text();
      throw new Error(`TikTok chunk ${i + 1}/${totalChunks} failed: ${text}`);
    }

    params.onProgress?.(Math.round(((i + 1) / totalChunks) * 80));
  }

  // Step 3: Poll for publish status
  const shareUrl = await pollTikTokStatus(token, publishId, params.onProgress);
  return { publishId, shareUrl };
}

async function pollTikTokStatus(
  token: string,
  publishId: string,
  onProgress?: (percent: number) => void,
  maxAttempts = 60
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(3000);

    const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    if (!res.ok) continue;

    const json = await res.json();
    const status = json.data?.status;
    const shareUrl = json.data?.publicaly_available_post_id?.[0]
      ? `https://www.tiktok.com/@me/video/${json.data.publicaly_available_post_id[0]}`
      : `https://www.tiktok.com/`;

    if (status === "PUBLISH_COMPLETE") {
      onProgress?.(100);
      return shareUrl;
    }
    if (status === "FAILED") {
      const reason = json.data?.fail_reason ?? "unknown";
      throw new Error(`TikTok publish failed: ${reason}`);
    }

    onProgress?.(80 + Math.min(attempt * 2, 18));
  }

  throw new Error("TikTok publish timed out after 3 minutes");
}

function buildCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const full = tags ? `${caption}\n${tags}` : caption;
  return full.slice(0, 2200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the TikTok user info for the authenticated user.
 * Used after OAuth connect to save the username.
 */
export async function getTikTokUserInfo(
  accessToken: string
): Promise<{ openId: string; displayName: string }> {
  const res = await fetch(
    `${TIKTOK_API}/user/info/?fields=open_id,display_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch TikTok user info");
  const json = await res.json();
  return {
    openId: json.data?.user?.open_id ?? "",
    displayName: json.data?.user?.display_name ?? "Unknown",
  };
}
