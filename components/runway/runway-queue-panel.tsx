"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRunwayStream } from "@/hooks/use-runway-stream";
import { cn } from "@/lib/utils";
import type { RunwayClipSummary } from "@/lib/runway/runway-events";
import { Download, Loader2, RefreshCw, Upload } from "lucide-react";

const STATUS_CONFIG = {
  queued: { label: "In Queue", className: "bg-zinc-100 text-zinc-700 border-zinc-200", animate: false },
  submitting: { label: "Sending...", className: "bg-blue-50 text-blue-700 border-blue-200", animate: true },
  generating: { label: "Generating", className: "bg-amber-50 text-amber-700 border-amber-200", animate: true },
  downloading: { label: "Downloading", className: "bg-purple-50 text-purple-700 border-purple-200", animate: true },
  muxing: { label: "Adding Audio", className: "bg-indigo-50 text-indigo-700 border-indigo-200", animate: true },
  complete: { label: "Complete", className: "bg-green-50 text-green-700 border-green-200", animate: false },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200", animate: false },
} satisfies Record<RunwayClipSummary["status"], { label: string; className: string; animate: boolean }>;

export function RunwayQueuePanel({ projectId }: { projectId: string }) {
  const {
    clipList,
    totalCostSoFar,
    estimatedTotalCost,
    estimatedSecondsRemaining,
    isGenerating,
    isAssembling,
    isComplete,
    assembledVideoUrl,
    completedCount,
    totalCount,
  } = useRunwayStream(projectId);

  if (clipList.length === 0) return null;

  const overallPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const byScene = clipList.reduce<Record<number, RunwayClipSummary[]>>((acc, clip) => {
    acc[clip.sceneIndex] ??= [];
    acc[clip.sceneIndex].push(clip);
    return acc;
  }, {});

  async function handleRetry(clipId: string) {
    await fetch(`/api/projects/${projectId}/runway/clips/${clipId}/retry`, { method: "POST" });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Runway ML Queue</h3>
            {isGenerating && !isComplete && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Live
              </span>
            )}
            {isAssembling && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Assembling
              </span>
            )}
            {isComplete && <Badge className="bg-green-600 text-white">Complete</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {totalCount} clips complete
          </p>
        </div>

        <Progress value={overallPct} className="mb-3 h-2" />

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Cost so far: <span className="font-mono font-semibold text-foreground">${totalCostSoFar.toFixed(2)}</span>
            {estimatedTotalCost > 0 && (
              <span> / ${estimatedTotalCost.toFixed(2)} estimated</span>
            )}
          </span>
          <span>{isAssembling ? "Stitching clips together..." : `Time remaining: ${formatRemaining(estimatedSecondsRemaining)}`}</span>
        </div>
      </div>

      {assembledVideoUrl && (
        <div className="border-b bg-green-50/60 p-4">
          <p className="mb-2 text-sm font-semibold text-green-800">Final assembled video</p>
          <video src={assembledVideoUrl} controls className="aspect-video max-h-80 w-full rounded-lg bg-black" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={assembledVideoUrl} download>
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/projects/${projectId}/publish`}>
                <Upload className="mr-2 h-4 w-4" />
                Publish
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[640px] space-y-5 overflow-y-auto p-4">
        {Object.entries(byScene)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([sceneIndex, clips]) => (
            <SceneGroup
              key={sceneIndex}
              sceneIndex={Number(sceneIndex)}
              clips={clips}
              onRetry={handleRetry}
            />
          ))}
      </div>
    </div>
  );
}

function SceneGroup({
  sceneIndex,
  clips,
  onRetry,
}: {
  sceneIndex: number;
  clips: RunwayClipSummary[];
  onRetry: (clipId: string) => void;
}) {
  const complete = clips.filter((clip) => clip.status === "complete").length;
  const pct = clips.length > 0 ? (complete / clips.length) * 100 : 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <p className="w-20 text-sm font-semibold">Scene {sceneIndex + 1}</p>
        <Progress value={pct} className="h-1.5 flex-1" />
        <p className="w-20 text-right text-xs text-muted-foreground">
          {complete}/{clips.length} clips
        </p>
      </div>
      <div className="space-y-2 border-l pl-3">
        {clips.map((clip) => (
          <ClipRow key={clip.clipId} clip={clip} onRetry={onRetry} />
        ))}
      </div>
    </section>
  );
}

function ClipRow({ clip, onRetry }: { clip: RunwayClipSummary; onRetry: (clipId: string) => void }) {
  const config = STATUS_CONFIG[clip.status];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition md:flex-row md:items-center",
        clip.status === "generating" && "border-amber-300 bg-amber-50/40",
        clip.status === "complete" && "border-green-300 bg-green-50/40",
        clip.status === "failed" && "border-red-300 bg-red-50/40"
      )}
    >
      <div className="w-32 shrink-0">
        <p className="font-mono text-xs font-bold">{clip.clipId}</p>
        <p className="text-xs text-muted-foreground">
          Scene {clip.sceneIndex + 1} · {clip.durationSeconds}s
        </p>
      </div>

      <span className={cn("inline-flex w-32 shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium", config.className)}>
        {config.animate && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
        {config.label}
      </span>

      <div className="min-w-0 flex-1">
        {clip.status === "queued" && (
          <p className="text-xs text-muted-foreground">Position #{clip.queuePosition ?? "-"} in queue</p>
        )}
        {clip.status === "generating" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-amber-700">{formatElapsed(clip.elapsedMs ?? 0)}</span>
            {clip.runwayTaskId && (
              <span className="truncate font-mono text-xs text-muted-foreground">
                Task {clip.runwayTaskId.slice(0, 14)}...
              </span>
            )}
          </div>
        )}
        {(clip.status === "submitting" || clip.status === "downloading" || clip.status === "muxing") && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
          </div>
        )}
        {clip.status === "complete" && clip.videoUrl && (
          <video
            src={clip.videoUrl}
            className="h-12 w-20 rounded bg-black object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(event) => event.currentTarget.play()}
            onMouseLeave={(event) => {
              event.currentTarget.pause();
              event.currentTarget.currentTime = 0;
            }}
          />
        )}
        {clip.status === "failed" && (
          <p className="truncate text-xs text-red-700">{clip.errorMessage ?? "Clip generation failed"}</p>
        )}
      </div>

      {clip.costUsd != null && <span className="font-mono text-xs text-muted-foreground">${clip.costUsd.toFixed(2)}</span>}

      {clip.status === "failed" && clip.retryCount < 3 && (
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onRetry(clip.clipId)}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatRemaining(seconds: number | null): string {
  if (seconds == null) return "Estimating...";
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

