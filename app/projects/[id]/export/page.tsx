import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ExportPanel from "./_components/export-panel";

export default async function ExportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { platform?: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { sceneNumber: "asc" },
        include: {
          shots: { select: { duration: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const totalDurationSec = project.scenes
    .flatMap((s) => s.shots)
    .reduce((sum, sh) => sum + sh.duration, 0);

  // Load recent exports
  const recentExports = await db.export.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Caption count for the Captions section
  const transcription = await db.transcription.findUnique({
    where: { projectId: project.id },
    select: { _count: { select: { segments: true } } },
  });
  const captionCount = transcription?._count.segments ?? 0;

  // Selected thumbnail for the Thumbnail section
  const selectedThumb = await db.projectThumbnail.findFirst({
    where: { projectId: project.id, isSelected: true, youtubeR2Key: { not: null } },
    select: { youtubeR2Key: true },
  });
  let selectedThumbnailUrl: string | null = null;
  if (selectedThumb?.youtubeR2Key) {
    try {
      const { getSignedViewUrl } = await import("@/lib/storage");
      selectedThumbnailUrl = await getSignedViewUrl(selectedThumb.youtubeR2Key, 7200);
    } catch {
      // R2 not configured in dev
    }
  }

  const initialPlatform =
    searchParams.platform &&
    ["YOUTUBE_SHORTS", "INSTAGRAM_REELS", "TIKTOK", "YOUTUBE_STANDARD"].includes(searchParams.platform)
      ? searchParams.platform
      : "YOUTUBE_SHORTS";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Export</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <ExportPanel
        projectId={project.id}
        projectName={project.name}
        totalDurationSec={totalDurationSec}
        initialPlatform={initialPlatform}
        captionCount={captionCount}
        selectedThumbnailUrl={selectedThumbnailUrl}
        recentExports={recentExports.map((e) => ({
          id: e.id,
          platform: e.platform,
          status: e.status,
          durationSec: e.durationSec,
          fileSizeBytes: e.fileSizeBytes,
          aiDisclosureApplied: e.aiDisclosureApplied,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
