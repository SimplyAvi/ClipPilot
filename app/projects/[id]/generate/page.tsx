import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import GenerationBoard from "./_components/generation-board";

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
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <GenerationBoard
        projectId={params.id}
        jobId={latestJob?.id ?? null}
        initialScenes={initialScenes}
      />
    </div>
  );
}
