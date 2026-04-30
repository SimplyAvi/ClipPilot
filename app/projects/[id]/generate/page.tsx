import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palette } from "lucide-react";
import GenerationBoard from "./_components/generation-board";
import { ProductionMonitor } from "@/components/generation/production-monitor";
import { VisualNarratorGenerateBoard } from "./_components/visual-narrator-generate-board";

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getPageData(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: {
        include: { shots: { orderBy: { shotNumber: "asc" } } },
        orderBy: { sceneNumber: "asc" },
      },
      jobs: {
        where: { type: "SCENE_GENERATE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      theme: { select: { id: true, name: true } },
      visualSegments: { orderBy: { sortOrder: "asc" } },
      narratorProfile: { select: { voiceId: true } },
      projectMusicTrack: { select: { audioPath: true, status: true } },
    },
  });

  return project ?? null;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function GeneratePage({
  params,
}: {
  params: { id: string };
}) {
  const project = await getPageData(params.id);
  if (!project) notFound();

  const latestJob = project.jobs[0] ?? null;

  // Serialize scenes to a plain shape safe for client props
  const initialScenes = project.scenes.map((scene) => ({
    id: scene.id,
    sceneNumber: scene.sceneNumber,
    title: scene.title,
      status: scene.status,
      productionMode: scene.productionMode,
      shots: scene.shots.map((shot) => ({
      id: shot.id,
      shotNumber: shot.shotNumber,
      shotType: shot.shotType,
      duration: shot.duration,
      status: shot.status,
      generatedVideoPath: shot.generatedVideoPath,
      thumbnailPath: shot.thumbnailPath,
      likenessChecked: shot.likenessChecked,
      likenessCheckPassed: shot.likenessCheckPassed,
      likenessMatchedName: shot.likenessMatchedName,
      flaggedReason: shot.flaggedReason,
      generationCostUsd: shot.generationCostUsd,
      variantCount: shot.variantCount,
      variantPaths: shot.variantPaths,
      approvedVariantIndex: shot.approvedVariantIndex,
      prompt: shot.prompt,
    })),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Generate</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{project.name}</span>
            {project.theme && (
              <Link href={`/themes/${project.theme.id}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 hover:text-foreground">
                <Palette className="h-3 w-3" />
                {project.theme.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      {project.productionMode === "visual_narrator" ? (
        <VisualNarratorGenerateBoard
          projectId={params.id}
          projectName={project.name}
          themeName={project.theme?.name ?? null}
          narratorConfigured={Boolean(project.narratorProfile?.voiceId)}
          musicConfigured={Boolean(project.projectMusicTrack?.audioPath)}
          segments={project.visualSegments.map((segment) => ({
            id: segment.id,
            label: segment.primarySubject || segment.visualConcept,
            status: segment.status,
            hasVisual: Boolean(segment.generatedVideoPath),
            hasAudio: Boolean(segment.narratorAudioPath),
          }))}
        />
      ) : (
        <GenerationBoard
          projectId={params.id}
          jobId={latestJob?.id ?? null}
          initialScenes={initialScenes}
          themeName={project.theme?.name ?? null}
          projectName={project.name}
          productionMode={project.productionMode}
        />
      )}
      <ProductionMonitor
        projectId={params.id}
        projectName={project.name}
        themeName={project.theme?.name ?? null}
        mode={project.productionMode}
      />
    </div>
  );
}
