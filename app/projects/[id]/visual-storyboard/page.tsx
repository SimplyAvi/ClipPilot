import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import { VisualStoryboardClient } from "./_components/visual-storyboard-client";

export default async function VisualStoryboardPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      theme: { select: { id: true, name: true, visualPromptModifier: true } },
      narratorProfile: { select: { voiceName: true, voiceId: true } },
      projectMusicTrack: { select: { status: true, audioPath: true } },
      visualSegments: {
        orderBy: { sortOrder: "asc" },
        include: { previews: { orderBy: { createdAt: "desc" }, take: 3 } },
      },
    },
  });

  if (!project) notFound();
  if (project.visualSegments.length === 0) redirect(`/projects/${project.id}/analysis`);

  const segments = await Promise.all(project.visualSegments.map(async (segment) => {
    const variantPaths = parseVariantPaths(segment.variantPaths);
    const variantUrls = await Promise.all(variantPaths.map((path) => getSignedViewUrl(path).catch(() => path)));
    const previews = await Promise.all(segment.previews.map(async (preview) => ({
      ...preview,
      createdAt: preview.createdAt.toISOString(),
      updatedAt: preview.updatedAt.toISOString(),
      approvedAt: preview.approvedAt?.toISOString() ?? null,
      viewUrl: preview.previewVideoPath ? await getSignedViewUrl(preview.previewVideoPath).catch(() => null) : null,
    })));
    return {
      ...segment,
      createdAt: segment.createdAt.toISOString(),
      updatedAt: segment.updatedAt.toISOString(),
      previews,
      viewUrl: segment.generatedVideoPath ? await getSignedViewUrl(segment.generatedVideoPath).catch(() => null) : null,
      variantUrls,
    };
  }));

  return (
    <VisualStoryboardClient
      project={{
        id: project.id,
        name: project.name,
        productionMode: project.productionMode,
        variantCount: project.variantCount,
        theme: project.theme,
        narratorProfile: project.narratorProfile,
        projectMusicTrack: project.projectMusicTrack,
      }}
      initialSegments={segments}
    />
  );
}

function parseVariantPaths(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
