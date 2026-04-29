/**
 * lib/analytics/analytics-sync.ts
 *
 * Orchestrates fetching analytics for all published social posts and
 * upserting the results into the VideoAnalytics table.
 *
 * Called by POST /api/analytics/sync (manual refresh) and can be wired
 * into a Vercel Cron Job for automatic background syncing.
 */

import { db } from "@/lib/db";
import { fetchYouTubeStats, fetchYouTubeInsights } from "./youtube-analytics";
import { fetchTikTokStats } from "./tiktok-analytics";
import { fetchInstagramStats } from "./instagram-analytics";

export interface SyncResult {
  synced: number;
  errors: { postId: string; platform: string; error: string }[];
  lastSyncedAt: string;
}

/**
 * Fetches analytics for all published SocialPost records and upserts
 * VideoAnalytics. Returns a summary of synced counts and any errors.
 */
export async function syncAllPosts(): Promise<SyncResult> {
  const posts = await db.socialPost.findMany({
    where: { status: "published" },
    select: {
      id: true,
      platform: true,
      platformPostId: true,
    },
  });

  let synced = 0;
  const errors: SyncResult["errors"] = [];

  for (const post of posts) {
    try {
      const stats = await fetchStatsForPost(post.platform, post.platformPostId);
      if (!stats) continue;

      await db.videoAnalytics.upsert({
        where: { socialPostId: post.id },
        update: {
          ...stats,
          fetchedAt: new Date(),
        },
        create: {
          socialPostId: post.id,
          platform: post.platform,
          ...stats,
        },
      });

      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ postId: post.id, platform: post.platform, error: message });
    }
  }

  return {
    synced,
    errors,
    lastSyncedAt: new Date().toISOString(),
  };
}

// ─── Platform dispatcher ──────────────────────────────────────────────────────

interface NormalizedStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  watchTimeSeconds: number;
  impressions: number;
  clickThroughRate: number | null;
  averageViewDuration: number | null;
  retentionRate: number | null;
}

async function fetchStatsForPost(
  platform: string,
  videoId: string
): Promise<NormalizedStats | null> {
  switch (platform) {
    case "youtube": {
      const [stats, insights] = await Promise.allSettled([
        fetchYouTubeStats(videoId),
        fetchYouTubeInsights(videoId),
      ]);

      const s = stats.status === "fulfilled" ? stats.value : null;
      const i = insights.status === "fulfilled" ? insights.value : null;

      if (!s) {
        if (stats.status === "rejected") throw stats.reason;
        return null;
      }

      return {
        viewCount: s.viewCount,
        likeCount: s.likeCount,
        commentCount: s.commentCount,
        shareCount: 0, // YouTube Data API doesn't expose share count
        watchTimeSeconds: i ? Math.round(i.averageViewDuration) : 0,
        impressions: i?.impressions ?? 0,
        clickThroughRate: i?.impressionsClickThroughRate ?? null,
        averageViewDuration: i?.averageViewDuration ?? null,
        retentionRate: i?.averageViewPercentage ?? null,
      };
    }

    case "tiktok": {
      const s = await fetchTikTokStats(videoId);
      return {
        viewCount: s.videoViews,
        likeCount: s.likes,
        commentCount: s.comments,
        shareCount: s.shares,
        watchTimeSeconds: Math.round(s.totalWatchTime),
        impressions: 0,
        clickThroughRate: null,
        averageViewDuration: s.averageWatchTime,
        retentionRate: null,
      };
    }

    case "instagram": {
      const s = await fetchInstagramStats(videoId);
      return {
        viewCount: s.plays,
        likeCount: s.likes,
        commentCount: s.comments,
        shareCount: s.shares,
        watchTimeSeconds: 0,
        impressions: s.reach,
        clickThroughRate: null,
        averageViewDuration: null,
        retentionRate: null,
      };
    }

    default:
      return null;
  }
}
