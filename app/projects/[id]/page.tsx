import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NextStepBanner } from "@/components/projects/next-step-banner";
import { RunwayGenerationPanel } from "@/components/runway/runway-generation-panel";
import {
  ArrowLeft, Clapperboard, Users, Music, ShieldCheck, Upload,
  Captions, Image as ImageIcon, Share2, History, BarChart2,
  Eye, ThumbsUp, Clock, ExternalLink, FolderOpen,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  COMPLETE: { label: "Complete", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "destructive" },
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      theme: { select: { id: true, name: true } },
      runwayClips: { orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }] },
      assembledVideo: true,
      scenes: { orderBy: { sceneNumber: "asc" } },
      visualSegments: { orderBy: { sortOrder: "asc" } },
      _count: { select: { scenes: true, assets: true, jobs: true } },
      posts: {
        where: { status: "published" },
        include: { analytics: true },
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const status = STATUS_LABELS[project.status] ?? STATUS_LABELS.DRAFT;
  const isVisualNarrator = project.productionMode === "visual_narrator";
  const publishedPosts = project.posts ?? [];
  const postsWithAnalytics = publishedPosts.filter((p) => p.analytics);

  // Aggregate analytics across all platforms for this project
  const totalViews = postsWithAnalytics.reduce((s, p) => s + p.analytics!.viewCount, 0);
  const totalLikes = postsWithAnalytics.reduce((s, p) => s + p.analytics!.likeCount, 0);
  const avgRetention = postsWithAnalytics.some((p) => p.analytics!.retentionRate != null)
    ? postsWithAnalytics
        .filter((p) => p.analytics!.retentionRate != null)
        .reduce((s, p) => s + p.analytics!.retentionRate!, 0) /
      postsWithAnalytics.filter((p) => p.analytics!.retentionRate != null).length
    : null;
  const runwayClipCount = estimateRunwayClipCount(project);
  const runwayClips = await Promise.all(project.runwayClips.map(async (clip) => ({
    id: clip.id,
    clipId: clip.clipId,
    sceneIndex: clip.sceneIndex,
    clipIndex: clip.clipIndex,
    durationSeconds: clip.durationSeconds,
    status: clip.status,
    videoUrl: clip.muxedVideoPath ? await storage.getUrl(clip.muxedVideoPath) : clip.videoPath ? await storage.getUrl(clip.videoPath) : null,
  })));
  const assembledVideo = project.assembledVideo
    ? {
        id: project.assembledVideo.id,
        videoPath: project.assembledVideo.videoPath,
        videoUrl: await storage.getUrl(project.assembledVideo.videoPath),
        durationSec: project.assembledVideo.durationSec,
        status: project.assembledVideo.status,
      }
    : null;
  const sceneDurations = getVideoSourceDurations(project);

  return (
    <div className="mx-auto max-w-3xl">
      <NextStepBanner projectId={project.id} />
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="secondary" title={isVisualNarrator ? "Visuals and narrator voice carry this project. No on-screen people are generated." : "Characters, voices, dialogue, and lip sync carry this project."}>
              {isVisualNarrator ? "🌿 Visual Narrator Mode" : "👤 Character Mode"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
          {project.status === "COMPLETE" && project.completedAt && (
            <p className="text-sm text-muted-foreground">
              Completed {new Date(project.completedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          {project.theme && (
            <Link
              href={`/themes/${project.theme.id}`}
              className="mt-1 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              🎨 {project.theme.name}
            </Link>
          )}
        </div>
      </div>

      {project.scripts.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/analysis`}>View Script Analysis</Link>
          </Button>
          <Button asChild>
            <Link href={isVisualNarrator ? `/projects/${project.id}/visual-storyboard` : `/projects/${project.id}/characters`}>
              {isVisualNarrator ? <Clapperboard className="mr-2 h-4 w-4" /> : <Users className="mr-2 h-4 w-4" />}
              {isVisualNarrator ? "Storyboard" : "Configure Characters"}
            </Link>
          </Button>
          {isVisualNarrator && (
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/narrator`}>
                <Users className="mr-2 h-4 w-4" />
                Narrator
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={isVisualNarrator ? `/projects/${project.id}/project-music` : `/projects/${project.id}/music`}>
              <Music className="mr-2 h-4 w-4" />
              {isVisualNarrator ? "Music Score" : "Music"}
            </Link>
          </Button>
          <Button asChild variant="default">
            <Link href={`/projects/${project.id}/generate`}>
              <Clapperboard className="mr-2 h-4 w-4" />
              Generate Video
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/compliance`}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Compliance
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/captions`}>
              <Captions className="mr-2 h-4 w-4" />
              Captions
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/thumbnails`}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Thumbnails
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/export`}>
              <Upload className="mr-2 h-4 w-4" />
              Export
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/publish`}>
              <Share2 className="mr-2 h-4 w-4" />
              Publish
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/versions`}>
              <History className="mr-2 h-4 w-4" />
              Versions
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/files`}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Files
            </Link>
          </Button>
        </div>
      )}

      {(runwayClipCount > 0 || runwayClips.length > 0) && (
        <div className="mb-8">
          <RunwayGenerationPanel
            projectId={project.id}
            initialClipCount={runwayClipCount}
            initialClips={runwayClips}
            initialAssembled={assembledVideo}
            projectVideoProvider={project.videoProvider}
            projectVideoAspectRatio={project.videoAspectRatio}
            sceneDurations={sceneDurations}
          />
        </div>
      )}

      {/* Performance Summary — shown only when there are published posts */}
      {publishedPosts.length > 0 && (
        <div className="mt-8 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Performance Summary</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {publishedPosts.length} post{publishedPosts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Link
              href="/analytics"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Full analytics
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {postsWithAnalytics.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Analytics not yet synced.{" "}
              <Link href="/analytics" className="underline underline-offset-2 hover:text-foreground">
                Sync now
              </Link>
            </div>
          ) : (
            <>
              {/* Aggregate stats */}
              <div className="grid grid-cols-3 divide-x border-b">
                <div className="flex flex-col items-center py-4">
                  <Eye className="mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-bold">{fmt(totalViews)}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div className="flex flex-col items-center py-4">
                  <ThumbsUp className="mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-bold">{fmt(totalLikes)}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div className="flex flex-col items-center py-4">
                  <Clock className="mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-bold">
                    {avgRetention != null ? `${avgRetention.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Retention</p>
                </div>
              </div>

              {/* Per-platform rows */}
              <div className="divide-y">
                {postsWithAnalytics.map((post) => (
                  <div key={post.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {PLATFORM_LABELS[post.platform] ?? post.platform}
                      </span>
                      <span className="text-muted-foreground">{post.title || "Untitled"}</span>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {fmt(post.analytics!.viewCount)}
                      </span>
                      {post.analytics!.retentionRate != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.analytics!.retentionRate.toFixed(1)}%
                        </span>
                      )}
                      <a
                        href={post.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function estimateRunwayClipCount(project: {
  scenes: Array<{ firstImagePath: string | null; durationSeconds: number | null }>;
  visualSegments: Array<{ generatedVideoPath: string | null; durationSeconds: number | null }>;
}) {
  const sceneSources = project.scenes.filter((scene) => scene.firstImagePath);
  const sources = sceneSources.length > 0
    ? sceneSources.map((scene) => scene.durationSeconds ?? 8)
    : project.visualSegments.filter((segment) => segment.generatedVideoPath).map((segment) => segment.durationSeconds ?? 8);
  return sources.reduce((sum, duration) => sum + splitCount(duration), 0);
}

function getVideoSourceDurations(project: {
  scenes: Array<{ firstImagePath: string | null; durationSeconds: number | null }>;
  visualSegments: Array<{ generatedVideoPath: string | null; durationSeconds: number | null }>;
}) {
  const sceneSources = project.scenes.filter((scene) => scene.firstImagePath);
  const durations = sceneSources.length > 0
    ? sceneSources.map((scene) => scene.durationSeconds ?? 8)
    : project.visualSegments.filter((segment) => segment.generatedVideoPath).map((segment) => segment.durationSeconds ?? 8);
  return durations.map((durationSeconds) => ({ durationSeconds }));
}

function splitCount(duration: number) {
  if (duration <= 5) return 1;
  let remaining = duration;
  let count = 0;
  while (remaining > 0) {
    if (remaining >= 10) remaining -= 10;
    else if (remaining >= 5) remaining -= 5;
    else remaining = 0;
    count += 1;
  }
  return count;
}
