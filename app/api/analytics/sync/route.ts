/**
 * POST /api/analytics/sync
 *
 * Manually triggers a full analytics sync for all published social posts.
 * Can also be wired to a Vercel Cron Job for automatic periodic syncing.
 *
 * Response: { synced: number; errors: [...]; lastSyncedAt: string }
 */

import { NextResponse } from "next/server";
import { syncAllPosts } from "@/lib/analytics/analytics-sync";

export async function POST() {
  try {
    const result = await syncAllPosts();

    return NextResponse.json(
      { data: result, error: null },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analytics/sync] Unexpected error:", message);
    return NextResponse.json(
      { data: null, error: `Sync failed: ${message}` },
      { status: 500 }
    );
  }
}
