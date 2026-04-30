import type { GenerationJob, GenerationTask } from "@prisma/client";

export function estimateJobDuration(taskCount: {
  shots: number;
  voiceLines: number;
  scenes: number;
  hasMusic: boolean;
  hasLipSync: boolean;
}): number {
  const seconds =
    taskCount.shots * 15 +
    taskCount.voiceLines * 3 +
    (taskCount.hasLipSync ? taskCount.shots * 8 : 0) +
    taskCount.scenes * 5 +
    (taskCount.hasMusic ? 30 : 0) +
    10 +
    5 +
    15;
  return Math.ceil(seconds * 1.2);
}

export function getRefinedEstimate(job: GenerationJob, completedTasks: GenerationTask[]): number {
  if (job.overallProgress < 20 || completedTasks.length === 0) {
    return job.estimatedTotalSeconds ?? 60;
  }
  const completedSeconds = completedTasks.reduce((sum, task) => sum + (task.durationSeconds ?? 0), 0);
  const average = completedSeconds / completedTasks.length;
  const estimatedTotalTasks = Math.max(completedTasks.length / (job.overallProgress / 100), completedTasks.length);
  const remainingTasks = Math.max(estimatedTotalTasks - completedTasks.length, 0);
  return Math.ceil(Math.max(remainingTasks * average, 10));
}
