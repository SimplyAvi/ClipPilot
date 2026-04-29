/**
 * Scene Generation Worker
 *
 * Processes one scene at a time, generating each shot sequentially.
 * After every shot it saves a checkpoint to Job.metadata so the job
 * can resume from where it left off if the process crashes.
 *
 * Job data shape:
 * {
 *   projectId, sceneId, jobId,
 *   shots: ShotConfig[],
 *   characterRefs: CharacterRef[],
 *   styleConfig: { location, timeOfDay, emotionalTone, genre }
 * }
 */

import { Worker, Job } from "bullmq";
import { redisConfig } from "@/lib/redis";
import { db } from "@/lib/db";
import { generateShot, type ShotConfig, type CharacterRef } from "@/lib/generators/video";
import { checkLikeness } from "@/lib/compliance/likeness-check";
import { downloadFromR2 } from "@/lib/storage";

// ─── Job data types ───────────────────────────────────────────────────────────

interface StyleConfig {
  location: string;
  timeOfDay: string;
  emotionalTone: string;
  genre: string;
}

export interface SceneGenShotData {
  shotId: string;
  shotNumber: number;
  shotType: string;
  duration: number;
  description: string;
  cameraMovement?: string;
  lighting?: string;
}

export interface SceneGenJobData {
  projectId: string;
  sceneId: string;
  jobId: string;
  shots: SceneGenShotData[];
  characterRefs: CharacterRef[];
  styleConfig: StyleConfig;
}

interface JobCheckpoint {
  completedShotIds: string[];
  lastCompletedShotId: string | null;
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function processSceneGeneration(job: Job<SceneGenJobData>) {
  const { projectId, sceneId, jobId, shots, characterRefs, styleConfig } = job.data;

  console.log(
    `[scene-gen] Starting job ${jobId} — scene ${sceneId} — ${shots.length} shots`
  );

  // ── Load checkpoint (resume support) ──
  const dbJob = await db.job.findUnique({ where: { id: jobId } });
  if (!dbJob) throw new Error(`Job ${jobId} not found in database`);

  const checkpoint: JobCheckpoint =
    (dbJob.metadata as JobCheckpoint | null) ?? {
      completedShotIds: [],
      lastCompletedShotId: null,
    };

  const alreadyDone = new Set(checkpoint.completedShotIds);
  const pendingShots = shots.filter((s) => !alreadyDone.has(s.shotId));

  console.log(
    `[scene-gen] Checkpoint: ${alreadyDone.size} done, ${pendingShots.length} remaining`
  );

  // ── Mark job as PROCESSING ──
  await db.job.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      totalShots: shots.length,
      completedShots: alreadyDone.size,
    },
  });

  // ── Process each pending shot sequentially ──
  for (const shot of pendingShots) {
    // Check if the job was paused or cancelled between shots
    const currentJob = await db.job.findUnique({ where: { id: jobId } });
    if (currentJob?.status === "PAUSED") {
      console.log(`[scene-gen] Job ${jobId} is paused — stopping after current shot`);
      return; // BullMQ will NOT mark this as failed; the job stays in active state
    }
    if (currentJob?.status === "CANCELLED") {
      console.log(`[scene-gen] Job ${jobId} cancelled`);
      throw new Error("Job cancelled by user");
    }

    console.log(`[scene-gen] Generating shot ${shot.shotNumber}/${shots.length}`);

    // Mark shot as GENERATING
    await db.shot.update({
      where: { id: shot.shotId },
      data: { status: "GENERATING" },
    });

    try {
      // Build the full ShotConfig with character refs and style
      const shotConfig: ShotConfig = {
        shotId: shot.shotId,
        shotNumber: shot.shotNumber,
        shotType: shot.shotType,
        duration: shot.duration,
        description: shot.description,
        cameraMovement: shot.cameraMovement,
        lighting: shot.lighting,
        location: styleConfig.location,
        timeOfDay: styleConfig.timeOfDay,
        emotionalTone: styleConfig.emotionalTone,
        characters: characterRefs,
      };

      // Generate the video
      const result = await generateShot(projectId, sceneId, shotConfig);

      // Run likeness check
      let likenessChecked = false;
      let likenessCheckPassed: boolean | null = null;
      let likenessMatchedName: string | null = null;
      let likenessScore: number | null = null;
      let flaggedReason: string | null = null;
      let shotStatus: "COMPLETE" | "NEEDS_REVIEW" = "COMPLETE";

      try {
        const videoBuffer = await downloadFromR2(result.r2Key);
        const likenessResult = await checkLikeness(videoBuffer, shot.shotId);

        likenessChecked = true;

        if (likenessResult.outcome === "flagged") {
          likenessCheckPassed = false;
          likenessMatchedName = likenessResult.matchedName;
          likenessScore = likenessResult.score;
          flaggedReason = likenessResult.reason;
          shotStatus = "NEEDS_REVIEW";
        } else if (likenessResult.outcome === "passed") {
          likenessCheckPassed = true;
        }
        // "skipped" → likenessChecked stays false
      } catch (likenessErr) {
        console.error(
          `[scene-gen] Likeness check error for shot ${shot.shotId}:`,
          likenessErr instanceof Error ? likenessErr.message : likenessErr
        );
        // Don't fail the whole shot over a likeness check error
      }

      // Save shot result to DB
      await db.shot.update({
        where: { id: shot.shotId },
        data: {
          status: shotStatus,
          generatedVideoPath: result.r2Key,
          storagePath: result.r2Key,
          storageBackend: result.backend,
          prompt: buildPromptSummary(shot, styleConfig),
          likenessChecked,
          likenessCheckPassed,
          likenessMatchedName,
          likenessScore,
          flaggedReason,
          generationCostUsd: result.costUsd,
        },
      });

      // ── Checkpoint save ──
      checkpoint.completedShotIds.push(shot.shotId);
      checkpoint.lastCompletedShotId = shot.shotId;

      const newCompletedCount = checkpoint.completedShotIds.length;
      const progressPct = Math.round((newCompletedCount / shots.length) * 100);

      await db.job.update({
        where: { id: jobId },
        data: {
          metadata: checkpoint as object,
          completedShots: newCompletedCount,
          progress: progressPct,
          costSoFar: { increment: result.costUsd },
        },
      });

      await job.updateProgress(progressPct);

      console.log(
        `[scene-gen] Shot ${shot.shotNumber} done — status=${shotStatus} cost=$${result.costUsd.toFixed(3)} progress=${progressPct}%`
      );
    } catch (shotErr) {
      const errMsg = shotErr instanceof Error ? shotErr.message : String(shotErr);
      console.error(`[scene-gen] Shot ${shot.shotNumber} failed:`, errMsg);

      // Mark shot as FAILED but continue to next shot
      await db.shot.update({
        where: { id: shot.shotId },
        data: { status: "FAILED", flaggedReason: errMsg },
      });
    }
  }

  // ── All shots processed — mark scene and job complete ──
  const finalShots = await db.shot.findMany({ where: { sceneId } });
  const allSucceeded = finalShots.every(
    (s) => s.status === "COMPLETE" || s.status === "NEEDS_REVIEW"
  );
  const anyFailed = finalShots.some((s) => s.status === "FAILED");

  if (allSucceeded) {
    await db.scene.update({
      where: { id: sceneId },
      data: { status: "RENDERED" },
    });
  }

  await db.job.update({
    where: { id: jobId },
    data: {
      status: anyFailed ? "FAILED" : "COMPLETE",
      progress: 100,
      completedShots: shots.length,
      error: anyFailed ? "One or more shots failed during generation" : null,
    },
  });

  console.log(
    `[scene-gen] Job ${jobId} finished — ${anyFailed ? "with failures" : "successfully"}`
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildPromptSummary(
  shot: SceneGenJobData["shots"][number],
  style: StyleConfig
): string {
  return `${shot.shotType} | ${style.location} | ${style.timeOfDay} | ${shot.description}`;
}

// ─── Worker registration ──────────────────────────────────────────────────────

export function startSceneGenerationWorker() {
  const worker = new Worker<SceneGenJobData>("scene-generate", processSceneGeneration, {
    connection: redisConfig,
    concurrency: 1, // One scene at a time — generation is expensive
    limiter: {
      max: 1,
      duration: 1_000,
    },
  });

  worker.on("completed", (job) => {
    console.log(`[scene-gen] BullMQ job ${job.id} completed`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[scene-gen] BullMQ job ${job?.id} failed:`, err.message);
    if (job?.data.jobId) {
      await db.job
        .update({
          where: { id: job.data.jobId },
          data: { status: "FAILED", error: err.message },
        })
        .catch(console.error);
    }
  });

  worker.on("error", (err) => {
    console.error("[scene-gen] Worker error:", err.message);
  });

  return worker;
}
