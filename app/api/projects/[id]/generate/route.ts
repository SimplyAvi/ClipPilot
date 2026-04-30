/**
 * POST /api/projects/[id]/generate
 *
 * Kicks off scene generation for a project.
 * - Validates the project has a parsed script
 * - Creates Scene + Shot records from the script analysis
 * - Creates a Job record (SCENE_GENERATE) and enqueues BullMQ jobs
 *   (one BullMQ job per scene)
 * - Returns { jobId, sceneJobIds }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sceneGenerateQueue } from "@/lib/queues";
import type { ScriptAnalysis } from "@/lib/prompts/script-analysis";
import type { SceneGenJobData, SceneGenShotData } from "@/workers/scene-generation.worker";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    // ── Load project with script + characters ──
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        scripts: { orderBy: { createdAt: "desc" }, take: 1 },
        projectCharacters: { include: { character: true } },
        theme: true,
      },
    });

    if (!project) {
      return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
    }

    const script = project.scripts[0];
    if (!script?.parsedData) {
      return NextResponse.json(
        { data: null, error: "Project has no analyzed script. Run script analysis first." },
        { status: 422 }
      );
    }

    const analysis = script.parsedData as unknown as ScriptAnalysis;

    // ── Create a parent Job record to track overall progress ──
    const totalShots = analysis.scenes.reduce((sum, s) => sum + s.beats.length, 0);

    const job = await db.job.create({
      data: {
        projectId,
        type: "SCENE_GENERATE",
        status: "PENDING",
        totalShots,
        estimatedCost: totalShots * 0.25, // rough estimate: $0.25/shot (5s Runway)
      },
    });

    // Update project status
    await db.project.update({
      where: { id: projectId },
      data: { status: "IN_PROGRESS" },
    });

    // ── Character refs for the worker ──
    const characterRefs = project.projectCharacters.map(({ character: c }) => ({
      name: c.name,
      description: c.physicalDescription,
    }));

    // ── Create Scene + Shot DB records and enqueue one BullMQ job per scene ──
    const enqueuedSceneJobIds: string[] = [];

    for (const sceneData of analysis.scenes) {
      // Upsert scene (idempotent if re-triggering)
      const scene = await db.scene.upsert({
        where: {
          // Use a synthetic unique key; Prisma requires a unique field
          // Fall back to create since there's no unique constraint on sceneNumber+projectId
          id: `${projectId}-scene-${sceneData.sceneNumber}`,
        },
        update: {
          title: sceneData.title,
          location: sceneData.location,
          timeOfDay: sceneData.timeOfDay,
          status: "DRAFT",
          useProjectTheme: project.themeMode !== "per_scene",
          productionMode: project.productionMode === "mixed" ? inferSceneProductionMode(sceneData.charactersPresent) : project.productionMode,
        },
        create: {
          id: `${projectId}-scene-${sceneData.sceneNumber}`,
          projectId,
          sceneNumber: sceneData.sceneNumber,
          title: sceneData.title,
          location: sceneData.location ?? null,
          timeOfDay: sceneData.timeOfDay,
          status: "DRAFT",
          useProjectTheme: project.themeMode !== "per_scene",
          productionMode: project.productionMode === "mixed" ? inferSceneProductionMode(sceneData.charactersPresent) : project.productionMode,
        },
      });

      // Create Shot records for each beat
      const shotConfigs: SceneGenShotData[] = [];

      for (let beatIdx = 0; beatIdx < sceneData.beats.length; beatIdx++) {
        const beat = sceneData.beats[beatIdx];
        const shotNumber = beatIdx + 1;
        const shotId = `${scene.id}-shot-${shotNumber}`;
        const shotDuration = estimateShotDuration(
          sceneData.estimatedDurationSeconds,
          sceneData.beats.length
        );

        await db.shot.upsert({
          where: { id: shotId },
          update: { status: "DRAFT", shotType: beat.suggestedShotType, variantCount: project.variantCount },
          create: {
            id: shotId,
            sceneId: scene.id,
            shotNumber,
            shotType: beat.suggestedShotType,
            duration: shotDuration,
            variantCount: project.variantCount,
            status: "DRAFT",
          },
        });

        shotConfigs.push({
          shotId,
          shotNumber,
          shotType: beat.suggestedShotType,
          duration: shotDuration,
          description: beat.description,
        });
      }

      // Enqueue BullMQ job for this scene
      const bullJob = await sceneGenerateQueue.add(
        `scene-${sceneData.sceneNumber}`,
        {
          projectId,
          sceneId: scene.id,
          jobId: job.id,
          shots: shotConfigs,
          characterRefs,
          styleConfig: {
            location: sceneData.location,
            timeOfDay: sceneData.timeOfDay,
            emotionalTone: sceneData.emotionalTone,
            genre: "general",
          },
          variantCount: project.variantCount,
        } satisfies SceneGenJobData,
        {
          attempts: 2,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      enqueuedSceneJobIds.push(bullJob.id ?? "");
    }

    // Update job to PROCESSING now that all BullMQ jobs are queued
    await db.job.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    return NextResponse.json({
      data: { jobId: job.id, sceneJobIds: enqueuedSceneJobIds },
      error: null,
    });
  } catch (err) {
    console.error("[POST /api/projects/[id]/generate]", err);
    return NextResponse.json(
      { data: null, error: "Failed to start generation" },
      { status: 500 }
    );
  }
}

function inferSceneProductionMode(charactersPresent: string[]): string {
  return charactersPresent.length > 0 ? "character_driven" : "visual_only";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateShotDuration(sceneDurationSec: number, beatCount: number): number {
  // Divide scene duration evenly among beats, clamp 2–10 seconds per shot
  const raw = sceneDurationSec / Math.max(beatCount, 1);
  return Math.min(Math.max(Math.round(raw), 2), 10);
}
