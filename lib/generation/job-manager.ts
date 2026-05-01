import type { GenerationJob, GenerationTask, Project } from "@prisma/client";
import { db } from "@/lib/db";
import type { ScriptAnalysis } from "@/lib/prompts/script-analysis";
import { estimateJobDuration } from "@/lib/generation/time-estimator";
import { broadcast } from "@/lib/generation/sse-broadcaster";
import type { ClipSpec } from "@/lib/runway/clip-planner";
import { getProviderConfig } from "@/lib/video-providers";

type LogLevel = "info" | "success" | "warning" | "error";

const CHARACTER_STAGES = [
  ["script_planning", "Script & Planning"],
  ["character_portraits", "Character Portraits"],
  ["voice_generation", "Voice Generation"],
  ["shot_generation", "Shot Generation"],
  ["lip_sync", "Lip Sync"],
  ["audio_mix", "Music & Audio Mix"],
  ["scene_assembly", "Scene Assembly"],
  ["final_stitch", "Final Stitch"],
  ["color_grade", "Color Grade"],
  ["export", "Export"],
] as const;

const VISUAL_STAGES = [
  ["script_segmentation", "Script Segmentation"],
  ["visual_generation", "Visual Generation"],
  ["narrator_audio", "Narrator Audio"],
  ["music_score", "Music Score"],
  ["timing_sync", "Timing Sync"],
  ["assembly_stitch", "Assembly & Stitch"],
  ["color_grade", "Color Grade"],
  ["export", "Export"],
] as const;

const RUNWAY_STAGES = [
  ["runway_planning", "Runway Clip Planning"],
  ["runway_generation", "Runway Image-to-Video"],
  ["runway_assembly", "Runway Assembly"],
] as const;

export async function createJob(projectId: string, fromCheckpoint = false) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      scenes: { include: { shots: true }, orderBy: { sceneNumber: "asc" } },
      visualSegments: { orderBy: { sortOrder: "asc" } },
      projectCharacters: { include: { character: true } },
    },
  });
  if (!project) throw new Error("Project not found");

  const previous = await db.generationJob.findUnique({ where: { projectId } });
  const checkpoint = fromCheckpoint ? parseCompletedIds(previous?.completedTaskIds) : new Set<string>();

  await db.generationJob.deleteMany({ where: { projectId } });
  const counts = countWork(project);
  const job = await db.generationJob.create({
    data: {
      projectId,
      status: "queued",
      estimatedTotalSeconds: estimateJobDuration(counts),
      totalCostEstimate: counts.shots * 0.25 + counts.voiceLines * 0.01 + (counts.hasMusic ? 1 : 0),
      completedTaskIds: JSON.stringify(Array.from(checkpoint)),
      currentStageLabel: project.productionMode === "visual_narrator" ? "Script Segmentation" : "Script & Planning",
    },
  });

  if (project.productionMode === "visual_narrator") {
    await createVisualNarratorTasks(job.id, project, checkpoint);
  } else {
    await createCharacterDrivenTasks(job.id, project, checkpoint);
  }

  await appendLog(job.id, "info", fromCheckpoint && checkpoint.size > 0 ? `Resuming from checkpoint - skipping ${checkpoint.size} completed tasks` : "Generation job created");
  const hydrated = await getJob(job.id);
  broadcast(projectId, { type: "job_update", data: hydrated });
  return hydrated;
}

export async function createRunwayJob(projectId: string, clips: ClipSpec[], providerId = "runway") {
  const provider = getProviderConfig(providerId);
  await db.generationJob.deleteMany({ where: { projectId } });
  const job = await db.generationJob.create({
    data: {
      projectId,
      status: "queued",
      estimatedTotalSeconds: clips.length * 45 + 30,
      totalCostEstimate: clips.reduce((sum, clip) => sum + (provider.pricing[clip.durationSeconds] ?? 0), 0),
      currentStageLabel: `${provider.label} Clip Planning`,
    },
  });

  const stages = new Map<string, GenerationTask>();
  for (let i = 0; i < RUNWAY_STAGES.length; i++) {
    const [taskType, label] = RUNWAY_STAGES[i];
    stages.set(taskType, await createTask(job.id, taskType, label, null, i + 1, { stableKey: `stage:${taskType}` }, new Set()));
  }
  const generationStage = stages.get("runway_generation");
  for (let i = 0; i < clips.length; i++) {
    await createTask(
      job.id,
      "runway_clip",
      `Generating ${clips[i].id}`,
      generationStage?.id ?? null,
      i + 1,
      { clipId: clips[i].id, stableKey: `runway:${clips[i].id}` },
      new Set()
    );
  }
  await appendLog(job.id, "info", `${provider.label} generation job created with ${clips.length} clips`);
  const hydrated = await getJob(job.id);
  broadcast(projectId, { type: "job_update", data: hydrated });
  return hydrated;
}

async function createCharacterDrivenTasks(jobId: string, project: ProjectWithWork, checkpoint: Set<string>) {
  const analysis = project.scripts[0]?.parsedData as unknown as ScriptAnalysis | undefined;
  const stages = new Map<string, GenerationTask>();
  for (let i = 0; i < CHARACTER_STAGES.length; i++) {
    const [taskType, label] = CHARACTER_STAGES[i];
    const task = await createTask(jobId, taskType, label, null, i + 1, { stableKey: `stage:${taskType}` }, checkpoint);
    stages.set(taskType, task);
  }

  const portraitStage = stages.get("character_portraits");
  for (const cast of project.projectCharacters) {
    await createTask(jobId, "character_portrait", `${cast.character.name} portrait`, portraitStage?.id ?? null, 1, { characterId: cast.characterId, stableKey: `portrait:${cast.characterId}` }, checkpoint);
  }

  const voiceStage = stages.get("voice_generation");
  for (const cast of project.projectCharacters) {
    await createTask(jobId, "voice_lines", `${cast.character.name} voice lines`, voiceStage?.id ?? null, 1, { characterId: cast.characterId, stableKey: `voice:${cast.characterId}` }, checkpoint);
  }

  const shotStage = stages.get("shot_generation");
  for (const sceneData of analysis?.scenes ?? []) {
    const sceneTask = await createTask(jobId, "scene_shots", `Scene ${sceneData.sceneNumber} - ${sceneData.title}`, shotStage?.id ?? null, sceneData.sceneNumber, { sceneNumber: sceneData.sceneNumber, stableKey: `scene:${sceneData.sceneNumber}` }, checkpoint);
    for (let i = 0; i < sceneData.beats.length; i++) {
      const shotNumber = i + 1;
      const sceneId = `${project.id}-scene-${sceneData.sceneNumber}`;
      const shotId = `${sceneId}-shot-${shotNumber}`;
      await createTask(jobId, "shot_generation", `Shot ${shotNumber} of ${sceneData.beats.length}`, sceneTask.id, shotNumber, { sceneId, shotId, sceneNumber: sceneData.sceneNumber, shotNumber, stableKey: `shot:${shotId}` }, checkpoint);
    }
  }

  const assemblyStage = stages.get("scene_assembly");
  for (const sceneData of analysis?.scenes ?? []) {
    await createTask(jobId, "scene_assembly", `Assemble Scene ${sceneData.sceneNumber}`, assemblyStage?.id ?? null, sceneData.sceneNumber, { sceneNumber: sceneData.sceneNumber, stableKey: `assemble:${sceneData.sceneNumber}` }, checkpoint);
  }
}

async function createVisualNarratorTasks(jobId: string, project: ProjectWithWork, checkpoint: Set<string>) {
  const stages = new Map<string, GenerationTask>();
  for (let i = 0; i < VISUAL_STAGES.length; i++) {
    const [taskType, label] = VISUAL_STAGES[i];
    const task = await createTask(jobId, taskType, label, null, i + 1, { stableKey: `stage:${taskType}` }, checkpoint);
    stages.set(taskType, task);
  }
  const visualStage = stages.get("visual_generation");
  const audioStage = stages.get("narrator_audio");
  for (const segment of project.visualSegments) {
    const desc = segment.primarySubject || segment.visualConcept.slice(0, 36);
    await createTask(jobId, "visual_segment", `Segment ${segment.sortOrder + 1} - ${desc}`, visualStage?.id ?? null, segment.sortOrder, { segmentId: segment.id, stableKey: `visual:${segment.id}` }, checkpoint);
    await createTask(jobId, "narrator_segment", `Segment ${segment.sortOrder + 1} audio`, audioStage?.id ?? null, segment.sortOrder, { segmentId: segment.id, stableKey: `audio:${segment.id}` }, checkpoint);
  }
}

async function createTask(jobId: string, taskType: string, label: string, parentTaskId: string | null, sortOrder: number, metadata: Record<string, unknown>, checkpoint: Set<string>) {
  const stableKey = String(metadata.stableKey ?? "");
  const complete = checkpoint.has(stableKey);
  return db.generationTask.create({
    data: {
      jobId,
      parentTaskId,
      taskType,
      label,
      sortOrder,
      metadata: JSON.stringify(metadata),
      status: complete ? "complete" : "pending",
      progress: complete ? 100 : 0,
      completedAt: complete ? new Date() : undefined,
    },
  });
}

export async function startTask(taskId: string): Promise<void> {
  const task = await db.generationTask.update({
    where: { id: taskId },
    data: { status: "running", startedAt: new Date(), progress: { increment: 0 } },
    include: { job: true },
  });
  await updateJobAfterTask(task.jobId, task.label);
  await appendLog(task.jobId, "info", `Started: ${task.label}`, task.id);
  broadcast(task.job.projectId, { type: "task_update", data: serializeTask(task) });
}

export async function updateTaskProgress(taskId: string, progress: number, message?: string): Promise<void> {
  const task = await db.generationTask.update({
    where: { id: taskId },
    data: { progress: Math.max(0, Math.min(progress, 100)) },
    include: { job: true },
  });
  await updateJobAfterTask(task.jobId, task.label);
  if (message) await appendLog(task.jobId, "info", message, task.id);
  broadcast(task.job.projectId, { type: "task_update", data: serializeTask(task) });
}

export async function completeTask(taskId: string, cost = 0, durationSeconds?: number): Promise<void> {
  const task = await db.generationTask.update({
    where: { id: taskId },
    data: { status: "complete", progress: 100, completedAt: new Date(), durationSeconds, costActual: cost },
    include: { job: true },
  });
  const completed = new Set(parseCompletedIds(task.job.completedTaskIds));
  const stableKey = getStableKey(task);
  if (stableKey) completed.add(stableKey);
  await db.generationJob.update({
    where: { id: task.jobId },
    data: { completedTaskIds: JSON.stringify(Array.from(completed)), totalCostActual: { increment: cost } },
  });
  await updateJobAfterTask(task.jobId, task.label);
  await appendLog(task.jobId, "success", `Done: ${task.label}${durationSeconds ? ` (${durationSeconds.toFixed(1)}s, $${cost.toFixed(2)})` : ""}`, task.id);
  broadcast(task.job.projectId, { type: "task_update", data: serializeTask(task) });
}

export async function failTask(taskId: string, error: string): Promise<void> {
  const task = await db.generationTask.update({
    where: { id: taskId },
    data: { status: "failed", errorMessage: error },
    include: { job: true },
  });
  await updateJobAfterTask(task.jobId, task.label);
  await appendLog(task.jobId, "error", `Failed: ${task.label} - ${error}`, task.id);
  broadcast(task.job.projectId, { type: "task_update", data: serializeTask(task) });
}

export async function pauseJob(jobId: string): Promise<void> {
  const job = await db.generationJob.update({
    where: { id: jobId },
    data: { status: "paused", pausedAt: new Date(), isPauseRequested: true },
  });
  await db.generationTask.updateMany({ where: { jobId, status: "running" }, data: { status: "paused" } });
  await appendLog(jobId, "warning", "Generation paused");
  broadcast(job.projectId, { type: "job_update", data: await getJob(jobId) });
}

export async function resumeJob(jobId: string): Promise<void> {
  const job = await db.generationJob.update({
    where: { id: jobId },
    data: { status: "running", pausedAt: null, isPauseRequested: false },
  });
  await db.generationTask.updateMany({ where: { jobId, status: "paused" }, data: { status: "pending" } });
  await appendLog(jobId, "info", "Generation resumed");
  broadcast(job.projectId, { type: "job_update", data: await getJob(jobId) });
}

export async function cancelJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  const completedIds = job.tasks.filter((task) => task.status === "complete").map((task) => getStableKey(task)).filter(Boolean);
  const updated = await db.generationJob.update({
    where: { id: jobId },
    data: { status: "cancelled", completedAt: new Date(), completedTaskIds: JSON.stringify(completedIds), isPauseRequested: true },
  });
  await appendLog(jobId, "warning", `Generation cancelled - checkpoint saved at ${Math.round(job.overallProgress)}%`);
  broadcast(updated.projectId, { type: "job_update", data: await getJob(jobId) });
}

export function calculateOverallProgress(tasks: GenerationTask[]): number {
  const leafTasks = tasks.filter((task) => !tasks.some((other) => other.parentTaskId === task.id));
  if (leafTasks.length === 0) return 0;
  let weighted = 0;
  let total = 0;
  for (const task of leafTasks) {
    if (!task.parentTaskId) continue;
    const weight = task.taskType.includes("shot") || task.taskType === "visual_segment" ? 3 : task.taskType.includes("assembly") ? 2 : 1;
    total += weight;
    weighted += weight * task.progress;
  }
  if (total === 0) return 0;
  return Math.round((weighted / total) * 10) / 10;
}

export function estimateRemainingSeconds(job: GenerationJob): number {
  if (!job.startedAt) return job.estimatedTotalSeconds ?? 60;
  if (job.overallProgress <= 0) return job.estimatedTotalSeconds ?? 60;
  const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
  return Math.max(Math.ceil((elapsed / job.overallProgress) * (100 - job.overallProgress)), 10);
}

export async function appendLog(jobId: string, level: LogLevel, message: string, taskId?: string): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId }, select: { projectId: true } });
  if (!job) return;
  const log = await db.generationLog.create({ data: { jobId, level, message, taskId } });
  broadcast(job.projectId, { type: "log", data: serializeLog(log) });
}

export async function getLatestJobForProject(projectId: string) {
  const job = await db.generationJob.findUnique({
    where: { projectId },
    include: { tasks: { orderBy: { sortOrder: "asc" } }, logs: { orderBy: { timestamp: "desc" }, take: 50 } },
  });
  return job ? serializeJob(job) : null;
}

export async function findTaskByMetadata(projectId: string, key: string, value: string) {
  const job = await db.generationJob.findUnique({ where: { projectId }, include: { tasks: true } });
  return job?.tasks.find((task) => {
    const meta = parseMeta(task.metadata);
    return meta[key] === value;
  }) ?? null;
}

export async function checkPauseFlag(projectId: string): Promise<boolean> {
  const job = await db.generationJob.findUnique({ where: { projectId }, select: { isPauseRequested: true, status: true } });
  return Boolean(job?.isPauseRequested || job?.status === "cancelled");
}

async function updateJobAfterTask(jobId: string, currentStageLabel?: string) {
  const tasks = await db.generationTask.findMany({ where: { jobId } });
  const progress = calculateOverallProgress(tasks);
  const status = progress >= 100 ? "complete" : "running";
  const existing = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  const job = await db.generationJob.update({
    where: { id: jobId },
    data: {
      status,
      startedAt: existing.startedAt ?? new Date(),
      completedAt: progress >= 100 ? new Date() : undefined,
      overallProgress: progress,
      currentStageLabel,
    },
  });
  broadcast(job.projectId, { type: "job_update", data: await getJob(jobId) });
}

async function getJob(jobId: string) {
  const job = await db.generationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }, logs: { orderBy: { timestamp: "desc" }, take: 50 } },
  });
  return serializeJob(job);
}

type ProjectWithWork = Awaited<ReturnType<typeof db.project.findUnique>> & {
  scripts: Array<{ parsedData: unknown }>;
  scenes: Array<{ shots: unknown[] }>;
  visualSegments: Array<{ id: string; sortOrder: number; primarySubject: string; visualConcept: string }>;
  projectCharacters: Array<{ characterId: string; character: { name: string } }>;
};

function countWork(project: ProjectWithWork) {
  const analysis = project.scripts[0]?.parsedData as unknown as ScriptAnalysis | undefined;
  const shots = analysis?.scenes.reduce((sum, scene) => sum + scene.beats.length, 0) ?? project.scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  return {
    shots: project.productionMode === "visual_narrator" ? project.visualSegments.length : shots,
    voiceLines: project.productionMode === "visual_narrator" ? project.visualSegments.length : 0,
    scenes: project.productionMode === "visual_narrator" ? project.visualSegments.length : (analysis?.scenes.length ?? project.scenes.length),
    hasMusic: true,
    hasLipSync: project.productionMode !== "visual_narrator",
  };
}

function parseCompletedIds(raw?: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function parseMeta(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getStableKey(task: Pick<GenerationTask, "metadata">) {
  return parseMeta(task.metadata).stableKey;
}

function serializeTask(task: GenerationTask) {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}

function serializeLog(log: { id: string; jobId: string; level: string; message: string; taskId: string | null; metadata: string | null; timestamp: Date }) {
  return { ...log, timestamp: log.timestamp.toISOString() };
}

function serializeJob(job: GenerationJob & { tasks: GenerationTask[]; logs: Array<{ id: string; jobId: string; level: string; message: string; taskId: string | null; metadata: string | null; timestamp: Date }> }) {
  return {
    ...job,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    pausedAt: job.pausedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    remainingSeconds: estimateRemainingSeconds(job),
    tasks: job.tasks.map(serializeTask),
    logs: job.logs.map(serializeLog),
  };
}
