"use client";

import { useState, useTransition, useCallback } from "react";
import {
  BarChart2,
  TrendingUp,
  DollarSign,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsRecord {
  id: string;
  platform: string;
  fetchedAt: string;
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

interface PostRecord {
  id: string;
  projectId: string;
  platform: string;
  platformPostId: string;
  postUrl: string;
  title: string;
  caption: string;
  publishedAt: string;
  status: string;
  analytics: AnalyticsRecord | null;
  project: {
    id: string;
    name: string;
    genre: string | null;
    tone: string | null;
    targetLength: string | null;
  };
}

interface CostRecord {
  id: string;
  projectId: string;
  provider: string;
  jobType: string;
  tokenCount: number | null;
  durationSeconds: number | null;
  cost: number;
  recordedAt: string;
}

interface ProjectRecord {
  id: string;
  name: string;
  genre: string | null;
  tone: string | null;
  targetLength: string | null;
  status: string;
}

export interface AnalyticsData {
  posts: PostRecord[];
  costs: CostRecord[];
  projects: ProjectRecord[];
  lastSyncedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-500",
  tiktok: "bg-black",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-400",
  runway: "bg-blue-500",
  elevenlabs: "bg-green-500",
  replicate: "bg-violet-500",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  runway: "Runway ML",
  elevenlabs: "ElevenLabs",
  replicate: "Replicate",
};

// ─── Overview Cards ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Performance Table ────────────────────────────────────────────────────────

type SortKey = "views" | "likes" | "comments" | "shares" | "retention" | "ctr" | "date";

function PerformanceTable({ posts }: { posts: PostRecord[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const withAnalytics = posts.filter((p) => p.analytics);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...withAnalytics].sort((a, b) => {
    const an = a.analytics!;
    const bn = b.analytics!;
    let av = 0, bv = 0;
    switch (sortKey) {
      case "views": av = an.viewCount; bv = bn.viewCount; break;
      case "likes": av = an.likeCount; bv = bn.likeCount; break;
      case "comments": av = an.commentCount; bv = bn.commentCount; break;
      case "shares": av = an.shareCount; bv = bn.shareCount; break;
      case "retention": av = an.retentionRate ?? -1; bv = bn.retentionRate ?? -1; break;
      case "ctr": av = an.clickThroughRate ?? -1; bv = bn.clickThroughRate ?? -1; break;
      case "date": av = new Date(a.publishedAt).getTime(); bv = new Date(b.publishedAt).getTime(); break;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  }

  function Th({ col, children }: { col: SortKey; children: React.ReactNode }) {
    return (
      <th
        className="cursor-pointer whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground hover:text-foreground select-none"
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-0.5">
          {children}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  if (withAnalytics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-12 text-center">
        <BarChart2 className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">No analytics data yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Publish videos and click Refresh to pull stats.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Video</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Platform</th>
            <Th col="views">Views</Th>
            <Th col="likes">Likes</Th>
            <Th col="comments">Comments</Th>
            <Th col="shares">Shares</Th>
            <Th col="retention">Retention</Th>
            <Th col="ctr">CTR</Th>
            <Th col="date">Published</Th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((post) => {
            const a = post.analytics!;
            return (
              <tr key={post.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-3 py-3 font-medium max-w-[200px]">
                  <span className="block truncate" title={post.title}>
                    {post.title || post.project.name}
                  </span>
                  {post.project.genre && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {post.project.genre}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {PLATFORM_LABELS[post.platform] ?? post.platform}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(a.viewCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(a.likeCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(a.commentCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(a.shareCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {a.retentionRate != null ? `${a.retentionRate.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {a.clickThroughRate != null ? `${(a.clickThroughRate * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-3">
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    aria-label="Open post"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── What's Working ───────────────────────────────────────────────────────────

function avgViews(posts: PostRecord[]): number {
  const with_ = posts.filter((p) => p.analytics);
  if (!with_.length) return 0;
  return with_.reduce((s, p) => s + p.analytics!.viewCount, 0) / with_.length;
}

function bestByGroup(
  posts: PostRecord[],
  key: keyof Pick<PostRecord["project"], "genre" | "tone" | "targetLength">
): { label: string; avg: number } | null {
  const groups = new Map<string, PostRecord[]>();
  for (const p of posts) {
    const val = p.project[key];
    if (!val) continue;
    if (!groups.has(val)) groups.set(val, []);
    groups.get(val)!.push(p);
  }
  if (!groups.size) return null;
  let best: { label: string; avg: number } | null = null;
  groups.forEach((group, label) => {
    const avg = avgViews(group);
    if (!best || avg > best.avg) best = { label, avg };
  });
  return best;
}

function bestPlatform(posts: PostRecord[]): { label: string; avg: number } | null {
  const groups = new Map<string, PostRecord[]>();
  for (const p of posts) {
    if (!groups.has(p.platform)) groups.set(p.platform, []);
    groups.get(p.platform)!.push(p);
  }
  if (!groups.size) return null;
  let best: { label: string; avg: number } | null = null;
  groups.forEach((group, platform) => {
    const avg = avgViews(group);
    if (!best || avg > best.avg)
      best = { label: PLATFORM_LABELS[platform] ?? platform, avg };
  });
  return best;
}

function WhatsWorking({ posts }: { posts: PostRecord[] }) {
  const insights = [
    { label: "Best Genre", result: bestByGroup(posts, "genre") },
    { label: "Best Tone", result: bestByGroup(posts, "tone") },
    { label: "Best Length", result: bestByGroup(posts, "targetLength") },
    { label: "Best Platform", result: bestPlatform(posts) },
  ].filter((i) => i.result);

  if (!insights.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-10 text-center">
        <Sparkles className="mb-3 h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Publish more videos with genre/tone tags to see insights.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {insights.map(({ label, result }) => (
        <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-bold capitalize">{result!.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            avg {fmt(Math.round(result!.avg))} views
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Cost Breakdown ───────────────────────────────────────────────────────────

function CostBreakdown({ costs }: { costs: CostRecord[] }) {
  const byProvider = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.provider] = (acc[c.provider] ?? 0) + c.cost;
    return acc;
  }, {});

  const total = Object.values(byProvider).reduce((s, v) => s + v, 0);
  const entries = Object.entries(byProvider).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-10 text-center">
        <DollarSign className="mb-3 h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No cost data recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-4 border-b">
        <p className="text-sm font-medium">Total Spend</p>
        <p className="text-2xl font-bold mt-0.5">{fmtUsd(total)}</p>
      </div>
      {/* Stacked bar */}
      <div className="p-4 space-y-3">
        <div className="flex h-5 w-full overflow-hidden rounded-full gap-0.5">
          {entries.map(([provider, amount]) => (
            <div
              key={provider}
              className={`${PROVIDER_COLORS[provider] ?? "bg-gray-400"} transition-all`}
              style={{ width: `${(amount / total) * 100}%` }}
              title={`${PROVIDER_LABELS[provider] ?? provider}: ${fmtUsd(amount)}`}
            />
          ))}
        </div>
        {/* Legend table */}
        <div className="space-y-2 mt-3">
          {entries.map(([provider, amount]) => (
            <div key={provider} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${PROVIDER_COLORS[provider] ?? "bg-gray-400"}`} />
                <span className="text-muted-foreground">
                  {PROVIDER_LABELS[provider] ?? provider}
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-xs text-muted-foreground">
                  {((amount / total) * 100).toFixed(1)}%
                </span>
                <span className="font-medium">{fmtUsd(amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Platform Comparison ──────────────────────────────────────────────────────

function PlatformComparison({ posts }: { posts: PostRecord[] }) {
  const platforms = Array.from(new Set(posts.map((p) => p.platform)));

  const rows = platforms.map((platform) => {
    const group = posts.filter((p) => p.platform === platform);
    const withAnalytics = group.filter((p) => p.analytics);
    const total = (key: keyof AnalyticsRecord) =>
      withAnalytics.reduce((s, p) => s + ((p.analytics![key] as number) || 0), 0);
    const avg = (key: keyof AnalyticsRecord) =>
      withAnalytics.length ? total(key) / withAnalytics.length : 0;

    return {
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      posts: group.length,
      avgViews: avg("viewCount"),
      avgLikes: avg("likeCount"),
      avgRetention: withAnalytics.some((p) => p.analytics!.retentionRate != null)
        ? withAnalytics
            .filter((p) => p.analytics!.retentionRate != null)
            .reduce((s, p) => s + p.analytics!.retentionRate!, 0) /
          withAnalytics.filter((p) => p.analytics!.retentionRate != null).length
        : null,
    };
  });

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-10 text-center">
        <BarChart2 className="mb-3 h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No platform data yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Platform</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Posts</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Avg Views</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Avg Likes</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Avg Retention</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.platform} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium">{row.label}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.posts}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(Math.round(row.avgViews))}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(Math.round(row.avgLikes))}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.avgRetention != null ? `${row.avgRetention.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const { posts, costs, lastSyncedAt } = data;
  const [isPending, startTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  const withAnalytics = posts.filter((p) => p.analytics);
  const totalViews = withAnalytics.reduce((s, p) => s + p.analytics!.viewCount, 0);
  const totalSpend = costs.reduce((s, c) => s + c.cost, 0);
  const avgCostPerVideo =
    withAnalytics.length > 0 ? totalSpend / withAnalytics.length : 0;

  const handleRefresh = useCallback(() => {
    startTransition(async () => {
      setSyncError(null);
      setSyncResult(null);
      try {
        const res = await fetch("/api/analytics/sync", { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Sync failed");
        setSyncResult({ synced: json.data?.synced ?? 0 });
        // Reload the page to show fresh data
        window.location.reload();
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Performance tracking across all published videos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Synced {timeAgo(lastSyncedAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Sync feedback */}
      {syncError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}
      {syncResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Synced {syncResult.synced} post{syncResult.synced !== 1 ? "s" : ""} successfully.
        </div>
      )}

      {/* Overview Cards */}
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={Eye}
            label="Total Videos"
            value={String(posts.length)}
            sub={`${withAnalytics.length} with analytics`}
            color="bg-blue-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Views"
            value={fmt(totalViews)}
            sub={withAnalytics.length > 0 ? `avg ${fmt(Math.round(totalViews / withAnalytics.length))}/video` : undefined}
            color="bg-violet-500"
          />
          <StatCard
            icon={DollarSign}
            label="Total Spend"
            value={fmtUsd(totalSpend)}
            sub={costs.length > 0 ? `${costs.length} cost events` : "No costs recorded"}
            color="bg-amber-500"
          />
          <StatCard
            icon={BarChart2}
            label="Avg Cost / Video"
            value={withAnalytics.length > 0 ? fmtUsd(avgCostPerVideo) : "—"}
            sub={withAnalytics.length > 0 ? "per published video" : undefined}
            color="bg-rose-500"
          />
        </div>
      </section>

      {/* Performance by Video */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Performance by Video</h2>
        </div>
        <PerformanceTable posts={posts} />
      </section>

      {/* What's Working */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">What&apos;s Working</h2>
          <span className="text-xs text-muted-foreground">
            — based on average views per category
          </span>
        </div>
        <WhatsWorking posts={posts} />
      </section>

      {/* Cost & Platform side-by-side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Cost Breakdown</h2>
          </div>
          <CostBreakdown costs={costs} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Platform Comparison</h2>
          </div>
          <PlatformComparison posts={posts} />
        </section>
      </div>
    </div>
  );
}
