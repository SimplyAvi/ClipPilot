/**
 * lib/analytics/tiktok-analytics.ts
 *
 * TikTok video analytics.
 *
 * IMPORTANT: TikTok's video performance data for creator accounts requires
 * the TikTok Research API, which must be separately applied for at:
 *   https://developers.tiktok.com/products/research-api/
 *
 * The standard Creator API (v2) provides basic video stats via the
 * /v2/video/query/ endpoint — this is what we use here.
 *
 * If Research API access is not approved, a clear error is thrown
 * so the dashboard can show an appropriate message.
 */

import { getValidToken } from "@/lib/social/token-manager";

export interface TikTokVideoStats {
  videoViews: number;
  likes: number;
  comments: number;
  shares: number;
  averageWatchTime: number; // seconds
  totalWatchTime: number;   // seconds
}

/**
 * Fetches TikTok video stats via the Creator API v2.
 * Requires the `video.list` scope granted during OAuth.
 */
export async function fetchTikTokStats(videoId: string): Promise<TikTokVideoStats> {
  let token: string;
  try {
    token = await getValidToken("tiktok");
  } catch {
    throw new Error("TikTok account not connected. Connect in Settings → Social Accounts.");
  }

  const res = await fetch("https://open.tiktokapis.com/v2/video/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filters: { video_ids: [videoId] },
      fields: ["id", "view_count", "like_count", "comment_count", "share_count",
               "average_time_watched", "total_time_watched"],
    }),
  });

  if (res.status === 401) {
    throw new Error("TikTok token expired or revoked. Re-connect your TikTok account in Settings.");
  }

  if (res.status === 403) {
    throw new Error(
      "TikTok analytics access denied. This may require TikTok Research API approval. " +
        "Apply at: https://developers.tiktok.com/products/research-api/"
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok API error ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.error?.code && json.error.code !== "ok") {
    // Research API not approved
    if (json.error.code === "access_token_invalid" || json.error.code === "spam_risk_too_many_requests") {
      throw new Error(
        `TikTok API error: ${json.error.message}. ` +
          "If you need detailed analytics, apply for TikTok Research API access at " +
          "https://developers.tiktok.com/products/research-api/"
      );
    }
    throw new Error(`TikTok API: ${json.error.message}`);
  }

  const video = json.data?.videos?.[0];
  if (!video) throw new Error(`TikTok video ${videoId} not found`);

  return {
    videoViews: video.view_count ?? 0,
    likes: video.like_count ?? 0,
    comments: video.comment_count ?? 0,
    shares: video.share_count ?? 0,
    averageWatchTime: video.average_time_watched ?? 0,
    totalWatchTime: video.total_time_watched ?? 0,
  };
}
