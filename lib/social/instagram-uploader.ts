/**
 * lib/social/instagram-uploader.ts
 *
 * Uploads a video as an Instagram Reel using the Instagram Graph API.
 * Requires a Business or Creator account connected to a Facebook Page.
 *
 * Flow:
 *   1. Create media container (video_url, caption)
 *   2. Poll container status until FINISHED
 *   3. Publish with media_publish
 */

import { getValidToken } from "./token-manager";
import { db } from "@/lib/db";

const GRAPH_API = "https://graph.instagram.com";
const GRAPH_VERSION = "v18.0";

// Platform limits
export const INSTAGRAM_MAX_SEC = 90;

export interface InstagramUploadParams {
  videoPath: string;
  publicVideoUrl: string; // Required: publicly accessible URL (R2 signed URL or CDN)
  caption: string;
  coverImageUrl?: string | null;
  shareToFeed: boolean;
  onProgress?: (percent: number) => void;
}

export interface InstagramUploadResult {
  mediaId: string;
  permalink: string;
}

export async function uploadToInstagram(
  params: InstagramUploadParams
): Promise<InstagramUploadResult> {
  const token = await getValidToken("instagram");

  // Get stored IG user ID
  const account = await db.socialAccount.findUnique({ where: { platform: "instagram" } });
  const igUserId = account?.platformUserId;
  if (!igUserId) {
    throw new Error("Instagram user ID not found. Reconnect in Settings.");
  }

  const baseUrl = `${GRAPH_API}/${GRAPH_VERSION}/${igUserId}`;

  // ── Step 1: Create Reels container ────────────────────────────────────────
  params.onProgress?.(10);

  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: params.publicVideoUrl,
    caption: params.caption.slice(0, 2200),
    share_to_feed: params.shareToFeed ? "true" : "false",
    access_token: token,
  });

  if (params.coverImageUrl) {
    containerParams.set("thumb_offset", "0");
    containerParams.set("cover_url", params.coverImageUrl);
  }

  const containerRes = await fetch(`${baseUrl}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: containerParams,
  });

  if (!containerRes.ok) {
    const json = await containerRes.json();
    if (containerRes.status === 429) {
      throw new Error(
        "Too many uploads — Instagram requires waiting before uploading again."
      );
    }
    const msg = json.error?.message ?? containerRes.statusText;
    throw new Error(`Failed to create Instagram media container: ${msg}`);
  }

  const containerJson = await containerRes.json();
  const containerId: string = containerJson.id;
  if (!containerId) throw new Error("Instagram did not return a container ID");

  // ── Step 2: Poll container status until FINISHED ───────────────────────────
  params.onProgress?.(20);
  await pollContainerStatus(token, containerId, params.onProgress);

  // ── Step 3: Publish ────────────────────────────────────────────────────────
  params.onProgress?.(90);

  const publishRes = await fetch(`${baseUrl}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });

  if (!publishRes.ok) {
    const json = await publishRes.json();
    const msg = json.error?.message ?? publishRes.statusText;
    throw new Error(`Instagram publish failed: ${msg}`);
  }

  const publishJson = await publishRes.json();
  const mediaId: string = publishJson.id;

  // ── Step 4: Get permalink ──────────────────────────────────────────────────
  let permalink = `https://www.instagram.com/`;
  try {
    const permalinkRes = await fetch(
      `${GRAPH_API}/${GRAPH_VERSION}/${mediaId}?fields=permalink&access_token=${token}`
    );
    if (permalinkRes.ok) {
      const permalinkJson = await permalinkRes.json();
      permalink = permalinkJson.permalink ?? permalink;
    }
  } catch {
    // Non-fatal
  }

  params.onProgress?.(100);
  return { mediaId, permalink };
}

async function pollContainerStatus(
  token: string,
  containerId: string,
  onProgress?: (percent: number) => void,
  maxAttempts = 36 // 36 × 5s = 3 minutes
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(5000);

    const res = await fetch(
      `${GRAPH_API}/${GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${token}`
    );

    if (!res.ok) continue;

    const json = await res.json();
    const statusCode: string = json.status_code;

    if (statusCode === "FINISHED") {
      onProgress?.(85);
      return;
    }

    if (statusCode === "ERROR") {
      const status = json.status ?? "Unknown error";
      throw new Error(`Instagram media processing failed: ${status}`);
    }

    if (statusCode === "EXPIRED") {
      throw new Error("Instagram media container expired before publishing");
    }

    // IN_PROGRESS or PUBLISHED — keep polling
    onProgress?.(20 + Math.min(attempt * 2, 60));
  }

  throw new Error("Instagram media processing timed out after 3 minutes");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches Instagram user info using a long-lived token.
 * Used after OAuth connect to save the username and ig_user_id.
 */
export async function getInstagramUserInfo(
  accessToken: string
): Promise<{ igUserId: string; username: string }> {
  const res = await fetch(
    `${GRAPH_API}/${GRAPH_VERSION}/me?fields=id,username&access_token=${accessToken}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Instagram user info: ${text}`);
  }
  const json = await res.json();
  return { igUserId: json.id, username: json.username };
}
