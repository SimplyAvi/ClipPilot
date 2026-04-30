"use client";

import { useEffect, useMemo, useState } from "react";

export type StreamJob = {
  id: string;
  projectId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  estimatedTotalSeconds: number | null;
  totalCostEstimate: number;
  totalCostActual: number;
  overallProgress: number;
  currentStageLabel: string | null;
  remainingSeconds?: number;
  tasks?: StreamTask[];
  logs?: StreamLog[];
};

export type StreamTask = {
  id: string;
  jobId: string;
  parentTaskId: string | null;
  taskType: string;
  label: string;
  status: string;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  costActual: number;
  errorMessage: string | null;
  retryCount: number;
  metadata: string | null;
  sortOrder: number;
};

export type StreamLog = {
  id: string;
  jobId: string;
  level: string;
  message: string;
  taskId: string | null;
  metadata: string | null;
  timestamp: string;
};

export function useGenerationStream(projectId: string) {
  const [job, setJob] = useState<StreamJob | null>(null);
  const [tasks, setTasks] = useState<StreamTask[]>([]);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const es = new EventSource(`/api/generation/${projectId}/stream`);

    es.addEventListener("initial_state", (event) => {
      const payload = JSON.parse(event.data);
      if (!payload) return;
      setJob(payload);
      setTasks(payload.tasks ?? []);
      setLogs(payload.logs ?? []);
    });

    es.addEventListener("job_update", (event) => {
      const payload = JSON.parse(event.data);
      setJob(payload);
      if (payload.tasks) setTasks(payload.tasks);
      if (payload.logs) setLogs(payload.logs);
    });

    es.addEventListener("task_update", (event) => {
      const task = JSON.parse(event.data) as StreamTask;
      setTasks((prev) => {
        const idx = prev.findIndex((item) => item.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });
    });

    es.addEventListener("log", (event) => {
      const log = JSON.parse(event.data) as StreamLog;
      setLogs((prev) => [log, ...prev].slice(0, 200));
    });

    return () => es.close();
  }, [projectId]);

  useEffect(() => {
    if (!job?.startedAt || job.status !== "running") return;
    const start = new Date(job.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [job?.startedAt, job?.status]);

  const failedTasks = useMemo(() => tasks.filter((task) => task.status === "failed"), [tasks]);

  return { job, tasks, logs, elapsed, failedTasks };
}
