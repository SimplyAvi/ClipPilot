/**
 * lib/analytics/youtube-analytics.ts
 *
 * Fetches video performance statistics from:
 *   - YouTube Data API v3 (public stats, no extra scope)
 *   - YouTube Analytics API (requires yt-analytics.readonly scope)
 *
 * Uses the stored OAuth token from SocialAccount via getValidToken().
 */

import { getValidToken } from "@/lib/social/token-manager";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeVideoStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  /** ISO 8601 duration, e.g. "PT1M30S" */
  duration: string;
}

export interface YouTubeInsightStats {
  estimatedMinutesWatched: number;
  averageViewDuration: number;   // seconds
  averageViewPercentage: number; // 0–100
  impressions: number;
  impressionsClickThroughRate: number; // 0–100
}

// ─── Data API (public statistics) ────────────────────────────────────────────

/**
 * Fetches viewCount, likeCount, commentCount, and duration.
 * Uses the authenticated user's access token so it works for
 * private/unlisted videos too.
 */
export async function fetchYouTubeStats(videoId: string): Promise<YouTubeVideoStats> {
  let token: string;
  try {
    token = await getValidToken("youtube");
  } catch {
    throw new Error("YouTube account not connected. Connect in Settings → Social Accounts.");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics,contentDetails");
  url.searchParams.set("id", videoId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube Data API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const item = json.items?.[0];
  if (!item) throw new Error(`YouTube video ${videoId} not found`);

  const stats = item.statistics ?? {};
  return {
    viewCount: parseInt(stats.viewCount ?? "0", 10),
    likeCount: parseInt(stats.likeCount ?? "0", 10),
    commentCount: parseInt(stats.commentCount ?? "0", 10),
    favoriteCount: parseInt(stats.favoriteCount ?? "0", 10),
    duration: item.contentDetails?.duration ?? "PT0S",
  };
}

// ─── Analytics API (detailed insights) ───────────────────────────────────────

/**
 * Fetches watch time, view duration, impressions, and CTR from the
 * YouTube Analytics API. Requires the yt-analytics.readonly OAuth scope.
 *
 * If the scope is not granted, throws a clear error message.
 */
export async function fetchYouTubeInsights(videoId: string): Promise<YouTubeInsightStats> {
  let token: string;
  try {
    token = await getValidToken("youtube");
  } catch {
    throw new Error("YouTube account not connected. Connect in Settings → Social Accounts.");
  }

  // Date range: from 2 years ago to today
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set(
    "metrics",
    "estimatedMinutesWatched,averageViewDuration,averageViewPercentage,impressions,impressionsClickThroughRate"
  );
  url.searchParams.set("filters", `video==${videoId}`);
  url.searchParams.set("dimensions", "video");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new Error(
      "YouTube Analytics API requires the yt-analytics.readonly scope. " +
        "Re-connect your YouTube account in Settings to grant this permission."
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube Analytics API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const row = json.rows?.[0];

  if (!row) {
    // Video exists but analytics aren't available yet (< 24–48 hrs)
    return {
      estimatedMinutesWatched: 0,
      averageViewDuration: 0,
      averageViewPercentage: 0,
      impressions: 0,
      impressionsClickThroughRate: 0,
    };
  }

  const [
    estimatedMinutesWatched,
    averageViewDuration,
    averageViewPercentage,
    impressions,
    impressionsClickThroughRate,
  ] = row as number[];

  return {
    estimatedMinutesWatched,
    averageViewDuration,
    averageViewPercentage,
    impressions,
    impressionsClickThroughRate,
  };
}
