import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sceneGenerateQueue } from "@/lib/queues";
import { appendLog, createJob } from "@/lib/generation/job-manager";
import { runVisualNarratorGeneration } from "@/lib/generation/visual-narrator-runner";
import type { ScriptAnalysis } from "@/lib/prompts/script-analysis";
import type { SceneGenJobData, SceneGenShotData } from "@/workers/scene-generation.worker";

const BodySchema = z.object({ fromCheckpoint: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const monitorJob = await createJob(params.projectId, parsed.data.fromCheckpoint ?? false);
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      include: {
        scripts: { orderBy: { createdAt: "desc" }, take: 1 },
        projectCharacters: { include: { character: true } },
      },
    });
    if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

    if (project.productionMode === "visual_narrator") {
      await db.generationJob.update({
        where: { projectId: project.id },
        data: { status: "running", startedAt: new Date(), currentStageLabel: "Visual Generation" },
      });
      await appendLog(monitorJob.id, "info", "Visual narrator generation queued.");
      runVisualNarratorGeneration(project.id, monitorJob.id).catch(async (err) => {
        const message = err instanceof Error ? err.message : "Visual narrator generation failed";
        await appendLog(monitorJob.id, "error", message);
        await db.generationJob.update({
          where: { id: monitorJob.id },
          data: { status: "failed", completedAt: new Date() },
        }).catch(() => undefined);
      });
      return NextResponse.json({ data: { generationJob: monitorJob, sceneJobIds: [] }, error: null });
    }

    const script = project.scripts[0];
    if (!script?.parsedData) {
      return NextResponse.json({ data: null, error: "Project has no analyzed script. Run script analysis first." }, { status: 422 });
    }

    const analysis = script.parsedData as unknown as ScriptAnalysis;
    const totalShots = analysis.scenes.reduce((sum, scene) => sum + scene.beats.length, 0);
    const legacyJob = await db.job.create({
      data: {
        projectId: project.id,
        type: "SCENE_GENERATE",
        status: "PENDING",
        totalShots,
        estimatedCost: totalShots * 0.25,
      },
    });

    await db.project.update({ where: { id: project.id }, data: { status: "IN_PROGRESS" } });
    await db.generationJob.update({
      where: { projectId: project.id },
      data: { status: "running", startedAt: new Date(), currentStageLabel: "Shot Generation" },
    });

    const characterRefs = project.projectCharacters.map(({ character }) => ({
      name: character.name,
      description: character.physicalDescription,
    }));
    const enqueuedSceneJobIds: string[] = [];

    for (const sceneData of analysis.scenes) {
      const scene = await db.scene.upsert({
        where: { id: `${project.id}-scene-${sceneData.sceneNumber}` },
        update: {
          title: sceneData.title,
          location: sceneData.location,
          timeOfDay: sceneData.timeOfDay,
          status: "DRAFT",
          productionMode: project.productionMode === "mixed" ? inferSceneProductionMode(sceneData.charactersPresent) : project.productionMode,
        },
        create: {
          id: `${project.id}-scene-${sceneData.sceneNumber}`,
          projectId: project.id,
          sceneNumber: sceneData.sceneNumber,
          title: sceneData.title,
          location: sceneData.location ?? null,
          timeOfDay: sceneData.timeOfDay,
          status: "DRAFT",
          productionMode: project.productionMode === "mixed" ? inferSceneProductionMode(sceneData.charactersPresent) : project.productionMode,
        },
      });

      const shotConfigs: SceneGenShotData[] = [];
      for (let beatIdx = 0; beatIdx < sceneData.beats.length; beatIdx++) {
        const beat = sceneData.beats[beatIdx];
        const shotNumber = beatIdx + 1;
        const shotId = `${scene.id}-shot-${shotNumber}`;
        const duration = estimateShotDuration(sceneData.estimatedDurationSeconds, sceneData.beats.length);
        await db.shot.upsert({
          where: { id: shotId },
          update: { status: "DRAFT", shotType: beat.suggestedShotType, variantCount: project.variantCount },
          create: { id: shotId, sceneId: scene.id, shotNumber, shotType: beat.suggestedShotType, duration, variantCount: project.variantCount, status: "DRAFT" },
        });
        shotConfigs.push({ shotId, shotNumber, shotType: beat.suggestedShotType, duration, description: beat.description });
      }

      const bullJob = await sceneGenerateQueue.add(`scene-${sceneData.sceneNumber}`, {
        projectId: project.id,
        sceneId: scene.id,
        jobId: legacyJob.id,
        generationJobId: monitorJob.id,
        shots: shotConfigs,
        characterRefs,
        styleConfig: {
          location: sceneData.location,
          timeOfDay: sceneData.timeOfDay,
          emotionalTone: sceneData.emotionalTone,
          genre: "general",
        },
        variantCount: project.variantCount,
      } satisfies SceneGenJobData, { attempts: 2, backoff: { type: "exponential", delay: 10_000 }, removeOnComplete: false, removeOnFail: false });
      enqueuedSceneJobIds.push(bullJob.id ?? "");
    }

    await db.job.update({ where: { id: legacyJob.id }, data: { status: "PROCESSING" } });
    await appendLog(monitorJob.id, "info", `Queued ${totalShots} shot generation tasks`);
    return NextResponse.json({ data: { generationJob: monitorJob, legacyJobId: legacyJob.id, sceneJobIds: enqueuedSceneJobIds }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start generation";
    console.error("[POST /api/generation/[projectId]/start]", err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

function inferSceneProductionMode(charactersPresent: string[]): string {
  return charactersPresent.length > 0 ? "character_driven" : "visual_only";
}

function estimateShotDuration(sceneDurationSec: number, beatCount: number): number {
  const raw = sceneDurationSec / Math.max(beatCount, 1);
  return Math.min(Math.max(Math.round(raw), 2), 10);
}
