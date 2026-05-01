"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RunwayClipSummary, RunwaySSEEvent } from "@/lib/runway/runway-events";
import { getProviderConfig } from "@/lib/video-providers/registry";

interface RunwayStreamState {
  clips: Record<string, RunwayClipSummary>;
  totalCostSoFar: number;
  estimatedTotalCost: number;
  estimatedSecondsRemaining: number | null;
  isGenerating: boolean;
  isAssembling: boolean;
  isComplete: boolean;
  assembledVideoUrl: string | null;
}

const ACTIVE_STATUSES = new Set(["queued", "submitting", "generating", "downloading", "muxing"]);

export function useRunwayStream(projectId: string) {
  const [state, setState] = useState<RunwayStreamState>({
    clips: {},
    totalCostSoFar: 0,
    estimatedTotalCost: 0,
    estimatedSecondsRemaining: null,
    isGenerating: false,
    isAssembling: false,
    isComplete: false,
    assembledVideoUrl: null,
  });
  const completionTimesMs = useRef<number[]>([]);

  useEffect(() => {
    if (!projectId) return;

    const es = new EventSource(`/api/projects/${projectId}/runway/stream`);
    const handle = (raw: MessageEvent) => {
      const event = JSON.parse(raw.data) as RunwaySSEEvent;
      setState((prev) => reduceRunwayEvent(prev, event, completionTimesMs.current));
    };

    const eventTypes: RunwaySSEEvent["type"][] = [
      "queue_snapshot",
      "clip_queued",
      "clip_submitting",
      "clip_generating",
      "clip_downloading",
      "clip_muxing",
      "clip_complete",
      "clip_failed",
      "scene_complete",
      "assembly_started",
      "assembly_complete",
      "job_complete",
    ];
    eventTypes.forEach((type) => es.addEventListener(type, handle));

    return () => {
      eventTypes.forEach((type) => es.removeEventListener(type, handle));
      es.close();
    };
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        let changed = false;
        const clips = Object.fromEntries(
          Object.entries(prev.clips).map(([id, clip]) => {
            if (clip.status !== "generating") return [id, clip];
            changed = true;
            return [id, { ...clip, elapsedMs: (clip.elapsedMs ?? 0) + 1000 }];
          })
        );
        return changed ? { ...prev, clips } : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const clipList = useMemo(
    () =>
      Object.values(state.clips).sort((a, b) =>
        a.sceneIndex !== b.sceneIndex ? a.sceneIndex - b.sceneIndex : a.clipIndex - b.clipIndex
      ),
    [state.clips]
  );
  const completedCount = clipList.filter((clip) => clip.status === "complete").length;
  const totalCount = clipList.length;

  return { ...state, clipList, completedCount, totalCount };
}

function reduceRunwayEvent(
  prev: RunwayStreamState,
  event: RunwaySSEEvent,
  completionTimesMs: number[]
): RunwayStreamState {
  const clips = { ...prev.clips };

  switch (event.type) {
    case "queue_snapshot": {
      const snapshot = Object.fromEntries(event.clips.map((clip) => [clip.clipId, clip]));
      const clipList = event.clips;
      return {
        ...prev,
        clips: snapshot,
        totalCostSoFar: clipList.reduce((sum, clip) => sum + (clip.costUsd ?? 0), 0),
        estimatedTotalCost: estimateTotalCost(clipList),
        isGenerating: clipList.some((clip) => ACTIVE_STATUSES.has(clip.status)),
        isComplete: clipList.length > 0 && clipList.every((clip) => clip.status === "complete"),
      };
    }
    case "clip_queued":
      clips[event.clipId] = {
        ...(clips[event.clipId] ?? { retryCount: 0 }),
        clipId: event.clipId,
        sceneIndex: event.sceneIndex,
        clipIndex: event.clipIndex,
        durationSeconds: event.durationSeconds,
        status: "queued",
        queuePosition: event.queuePosition,
      };
      return { ...prev, clips, isGenerating: true, estimatedTotalCost: estimateTotalCost(Object.values(clips)) };
    case "clip_submitting":
      clips[event.clipId] = { ...clips[event.clipId], status: "submitting", queuePosition: undefined };
      return { ...prev, clips, isGenerating: true };
    case "clip_generating":
      clips[event.clipId] = {
        ...clips[event.clipId],
        status: "generating",
        runwayTaskId: event.runwayTaskId,
        elapsedMs: event.elapsedMs,
      };
      return { ...prev, clips, isGenerating: true };
    case "clip_downloading":
      clips[event.clipId] = { ...clips[event.clipId], status: "downloading" };
      return { ...prev, clips };
    case "clip_muxing":
      clips[event.clipId] = { ...clips[event.clipId], status: "muxing" };
      return { ...prev, clips };
    case "clip_complete": {
      const elapsed = event.durationMs || clips[event.clipId]?.elapsedMs || defaultClipMs(clips[event.clipId]?.durationSeconds);
      clips[event.clipId] = {
        ...clips[event.clipId],
        status: "complete",
        videoUrl: event.videoUrl,
        costUsd: event.costUsd,
        elapsedMs: elapsed,
      };
      completionTimesMs.push(elapsed);
      if (completionTimesMs.length > 5) completionTimesMs.shift();
      const remaining = Object.values(clips).filter((clip) => clip.status !== "complete" && clip.status !== "failed").length;
      const averageMs = completionTimesMs.reduce((sum, ms) => sum + ms, 0) / completionTimesMs.length;
      return {
        ...prev,
        clips,
        totalCostSoFar: event.totalCostSoFar,
        estimatedSecondsRemaining: remaining > 0 ? Math.round((averageMs * remaining) / 1000) : 0,
      };
    }
    case "clip_failed":
      clips[event.clipId] = {
        ...clips[event.clipId],
        status: "failed",
        errorMessage: event.error,
        retryCount: event.retryCount,
      };
      return { ...prev, clips };
    case "assembly_started":
      return { ...prev, isAssembling: true };
    case "assembly_complete":
      return {
        ...prev,
        isAssembling: false,
        isComplete: true,
        isGenerating: false,
        assembledVideoUrl: event.videoUrl,
        totalCostSoFar: event.totalCostUsd,
        estimatedSecondsRemaining: 0,
      };
    case "job_complete":
      return { ...prev, isGenerating: false, isComplete: true, totalCostSoFar: event.totalCostUsd };
    default:
      return prev;
  }
}

function estimateTotalCost(clips: RunwayClipSummary[]) {
  const runway = getProviderConfig("runway");
  return clips.reduce((sum, clip) => sum + (clip.costUsd ?? runway.pricing[clip.durationSeconds] ?? 0), 0);
}

function defaultClipMs(durationSeconds?: number) {
  return durationSeconds === 10 ? 90_000 : 60_000;
}
