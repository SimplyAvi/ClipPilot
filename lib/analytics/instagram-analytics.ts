/**
 * lib/analytics/instagram-analytics.ts
 *
 * Fetches Reel performance data from the Instagram Graph API.
 *
 * Required Graph API permissions:
 *   - instagram_basic
 *   - instagram_manage_insights
 *   - pages_read_engagement (for business accounts)
 *
 * Note: Instagram analytics are only available for Business or Creator
 * accounts connected to a Facebook Page.
 */

import { getValidToken } from "@/lib/social/token-manager";

export interface InstagramVideoStats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  reach: number;
  totalInteractions: number;
}

/**
 * Fetches Instagram Reel insights from the Graph API.
 * mediaId is the Instagram media ID (returned when the Reel was posted).
 */
export async function fetchInstagramStats(mediaId: string): Promise<InstagramVideoStats> {
  let token: string;
  try {
    token = await getValidToken("instagram");
  } catch {
    throw new Error("Instagram account not connected. Connect in Settings → Social Accounts.");
  }

  // Step 1: Fetch insights from the media insights endpoint
  const metricsParam = "plays,likes,comments,shares,saved,reach,total_interactions";
  const insightsUrl = new URL(`https://graph.instagram.com/v19.0/${mediaId}/insights`);
  insightsUrl.searchParams.set("metric", metricsParam);
  insightsUrl.searchParams.set("access_token", token);

  const res = await fetch(insightsUrl.toString());

  if (res.status === 400) {
    const json = await res.json();
    if (json.error?.message?.includes("24 hours")) {
      throw new Error(
        "Instagram analytics are not yet available. Data typically appears 24–48 hours after publishing."
      );
    }
    if (json.error?.message?.includes("permission")) {
      throw new Error(
        "Instagram insights require a Business or Creator account connected to a Facebook Page. " +
          "Please check your Instagram account type in Settings."
      );
    }
    throw new Error(`Instagram API error: ${json.error?.message ?? "Unknown error"}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram Graph API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const metrics: Record<string, number> = {};

  for (const item of json.data ?? []) {
    metrics[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
  }

  return {
    plays: metrics.plays ?? 0,
    likes: metrics.likes ?? 0,
    comments: metrics.comments ?? 0,
    shares: metrics.shares ?? 0,
    saved: metrics.saved ?? 0,
    reach: metrics.reach ?? 0,
    totalInteractions: metrics.total_interactions ?? 0,
  };
}
