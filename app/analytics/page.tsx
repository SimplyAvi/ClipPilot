/**
 * /analytics — Analytics & Performance Tracking
 *
 * Server component: fetches all published posts with analytics,
 * project costs, and project metadata, then passes to the client dashboard.
 */

import { db } from "@/lib/db";
import { AnalyticsDashboard, type AnalyticsData } from "./_components/analytics-dashboard";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getAnalyticsData(): Promise<AnalyticsData> {
  const [posts, costRows, projects] = await Promise.all([
    db.socialPost.findMany({
      where: { status: "published" },
      include: {
        analytics: true,
        project: {
          select: {
            id: true,
            name: true,
            genre: true,
            tone: true,
            targetLength: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    }),
    db.projectCost.findMany({
      orderBy: { recordedAt: "desc" },
    }),
    db.project.findMany({
      select: {
        id: true,
        name: true,
        genre: true,
        tone: true,
        targetLength: true,
        status: true,
      },
    }),
  ]);

  // Serialize dates to strings for client components
  const serializedPosts = posts.map((p) => ({
    ...p,
    publishedAt: p.publishedAt.toISOString(),
    analytics: p.analytics
      ? {
          ...p.analytics,
          fetchedAt: p.analytics.fetchedAt.toISOString(),
        }
      : null,
  }));

  const serializedCosts = costRows.map((c) => ({
    ...c,
    recordedAt: c.recordedAt.toISOString(),
  }));

  // Last synced = most recent analytics fetchedAt
  const allFetchedAts = posts
    .map((p) => p.analytics?.fetchedAt)
    .filter(Boolean) as Date[];
  const lastSyncedAt = allFetchedAts.length
    ? new Date(Math.max(...allFetchedAts.map((d) => d.getTime()))).toISOString()
    : null;

  return {
    posts: serializedPosts,
    costs: serializedCosts,
    projects,
    lastSyncedAt,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  let data: AnalyticsData;
  try {
    data = await getAnalyticsData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive font-medium">Failed to load analytics</p>
        <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
      </div>
    );
  }

  return <AnalyticsDashboard data={data} />;
}
