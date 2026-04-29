/**
 * Home page — rich project dashboard
 *
 * Server component: fetches all projects with rich metadata, generates
 * signed thumbnail URLs for the 5 most-recent non-archived projects, then
 * hands everything to the <ProjectDashboard> client component.
 */

import Link from "next/link";
import { Plus, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import ProjectDashboard, {
  type DashboardProject,
  type QuickStartTemplate,
} from "@/app/_components/project-dashboard";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getAllProjects(): Promise<DashboardProject[]> {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { scenes: true, assets: true, jobs: true, posts: true },
      },
      exports: {
        where: { status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, platform: true, createdAt: true },
      },
    },
  });

  // Serialize Date objects to ISO strings for the client component
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    platform: p.platform ?? null,
    thumbnailPath: p.thumbnailPath ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    _count: p._count,
    exports: p.exports.map((e) => ({
      id: e.id,
      platform: e.platform,
      createdAt: e.createdAt.toISOString(),
    })),
  }));
}

async function getThumbnailUrls(
  projects: DashboardProject[]
): Promise<Record<string, string>> {
  // Only sign URLs for the 5 most-recent non-archived projects that have a thumbnail
  const candidates = projects
    .filter((p) => p.status !== "ARCHIVED" && p.thumbnailPath)
    .slice(0, 5);

  const entries = await Promise.allSettled(
    candidates.map(async (p) => {
      const url = await getSignedViewUrl(p.thumbnailPath!, 3600);
      return [p.id, url] as [string, string];
    })
  );

  const urls: Record<string, string> = {};
  for (const result of entries) {
    if (result.status === "fulfilled") {
      const [id, url] = result.value;
      urls[id] = url;
    }
  }
  return urls;
}

async function getQuickStartTemplates(): Promise<QuickStartTemplate[]> {
  const templates = await db.template.findMany({
    orderBy: [{ usageCount: "desc" }, { createdAt: "asc" }],
    take: 3,
    select: {
      id: true,
      name: true,
      genre: true,
      tone: true,
      targetPlatform: true,
      targetLength: true,
    },
  });
  return templates;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  let projects: DashboardProject[] = [];
  let thumbnailUrls: Record<string, string> = {};
  let quickStartTemplates: QuickStartTemplate[] = [];

  try {
    [projects, quickStartTemplates] = await Promise.all([
      getAllProjects(),
      getQuickStartTemplates(),
    ]);
    thumbnailUrls = await getThumbnailUrls(projects);
  } catch (err) {
    console.error("[HomePage] Failed to load projects:", err);
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Top bar ── */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">ClipPilot</h1>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Video
          </Link>
        </Button>
      </header>

      {/* ── Dashboard ── */}
      <ProjectDashboard
        initialProjects={projects}
        thumbnailUrls={thumbnailUrls}
        quickStartTemplates={quickStartTemplates}
      />
    </div>
  );
}
