"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Play,
  Pause,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Film,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShotData {
  id: string;
  shotNumber: number;
  shotType: string;
  duration: number;
  status: "DRAFT" | "GENERATING" | "COMPLETE" | "FAILED" | "NEEDS_REVIEW";
  generatedVideoPath: string | null;
  thumbnailPath: string | null;
  likenessChecked: boolean;
  likenessCheckPassed: boolean | null;
  likenessMatchedName: string | null;
  flaggedReason: string | null;
  generationCostUsd: number | null;
}

interface SceneData {
  id: string;
  sceneNumber: number;
  title: string;
  status: string;
  shots: ShotData[];
}

interface ProgressPayload {
  jobId: string;
  status: string;
  progress: number;
  costSoFar: number;
  estimatedCost: number | null;
  totalShots: number;
  completedShots: number;
  error: string | null;
  scenes: SceneData[];
}

interface GenerationBoardProps {
  projectId: string;
  jobId: string | null;
  initialScenes: SceneData[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHOT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Queued",
    color: "bg-muted text-muted-foreground",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  GENERATING: {
    label: "Generating",
    color: "bg-blue-100 text-blue-700",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  COMPLETE: {
    label: "Complete",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-700",
    icon: <X className="h-3.5 w-3.5" />,
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    color: "bg-amber-100 text-amber-700",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

function ShotCard({ shot }: { shot: ShotData }) {
  const cfg = SHOT_STATUS_CONFIG[shot.status] ?? SHOT_STATUS_CONFIG.DRAFT;

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      {/* Thumbnail or placeholder */}
      <div className="relative flex h-24 items-center justify-center rounded-t-lg bg-muted">
        {shot.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.thumbnailPath}
            alt={`Shot ${shot.shotNumber} thumbnail`}
            className="h-full w-full rounded-t-lg object-cover"
          />
        ) : shot.status === "GENERATING" ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Film className="h-8 w-8 text-muted-foreground/50" />
        )}

        {/* Status badge overlay */}
        <div className="absolute bottom-1.5 left-1.5">
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.color}`}
          >
            {cfg.icon}
            {cfg.label}
          </span>
        </div>

        {/* Video preview link */}
        {shot.generatedVideoPath && shot.status === "COMPLETE" && (
          <a
            href={`/api/shots/${shot.id}/video`}
            target="_blank"
            rel="noreferrer"
            className="absolute right-1.5 top-1.5 rounded bg-black/50 p-1 text-white hover:bg-black/70"
          >
            <Eye className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Shot info */}
      <div className="p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Shot {shot.shotNumber}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {shot.shotType}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{shot.duration}s</p>

        {/* Flagged reason */}
        {shot.status === "NEEDS_REVIEW" && shot.flaggedReason && (
          <p className="mt-1 text-[10px] text-amber-700">{shot.flaggedReason}</p>
        )}

        {/* Cost */}
        {shot.generationCostUsd != null && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            ${shot.generationCostUsd.toFixed(3)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GenerationBoard({
  projectId,
  jobId: initialJobId,
  initialScenes,
}: GenerationBoardProps) {
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [jobStatus, setJobStatus] = useState<string | null>(
    initialJobId ? "PROCESSING" : null
  );
  const [progress, setProgress] = useState(0);
  const [costSoFar, setCostSoFar] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [totalShots, setTotalShots] = useState(0);
  const [completedShots, setCompletedShots] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // ── SSE subscription ──
  const subscribeToProgress = useCallback((id: string) => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource(`/api/jobs/${id}/progress`);
    esRef.current = es;

    es.addEventListener("progress", (e) => {
      const data: ProgressPayload = JSON.parse(e.data);
      setJobStatus(data.status);
      setProgress(data.progress);
      setCostSoFar(data.costSoFar);
      setEstimatedCost(data.estimatedCost);
      setTotalShots(data.totalShots);
      setCompletedShots(data.completedShots);
      setJobError(data.error);
      if (data.scenes.length > 0) setScenes(data.scenes);
    });

    es.addEventListener("done", () => {
      es.close();
    });

    es.addEventListener("error", () => {
      es.close();
    });
  }, []);

  useEffect(() => {
    if (initialJobId) subscribeToProgress(initialJobId);
    return () => esRef.current?.close();
  }, [initialJobId, subscribeToProgress]);

  // ── Start generation ──
  async function handleStart() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start");
      const newJobId: string = json.data.jobId;
      setJobId(newJobId);
      setJobStatus("PROCESSING");
      subscribeToProgress(newJobId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setStarting(false);
    }
  }

  // ── Job control (pause / resume / cancel) ──
  async function handleControl(action: "pause" | "resume" | "cancel") {
    if (!jobId) return;
    setControlling(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Control failed");
      setJobStatus(json.data.status);
    } catch (err) {
      console.error("Job control error:", err);
    } finally {
      setControlling(false);
    }
  }

  const isRunning = jobStatus === "PROCESSING";
  const isPaused = jobStatus === "PAUSED";
  const isTerminal = ["COMPLETE", "FAILED", "CANCELLED"].includes(jobStatus ?? "");
  const hasJob = !!jobId;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Job controls + cost meter ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          {/* Status badge */}
          {jobStatus && (
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <Badge
                variant={
                  jobStatus === "COMPLETE"
                    ? "default"
                    : jobStatus === "FAILED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {jobStatus}
              </Badge>
              {isRunning && (
                <span className="text-sm text-muted-foreground">
                  {completedShots}/{totalShots} shots
                </span>
              )}
            </div>
          )}

          {/* Cost meter */}
          {hasJob && (
            <div className="flex items-center gap-1.5 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">${costSoFar.toFixed(3)}</span>
              {estimatedCost != null && (
                <span className="text-muted-foreground">
                  / est. ${estimatedCost.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {jobError && (
            <p className="text-sm text-destructive">{jobError}</p>
          )}
          {startError && (
            <p className="text-sm text-destructive">{startError}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!hasJob && (
            <Button onClick={handleStart} disabled={starting}>
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Generation
            </Button>
          )}

          {hasJob && !isTerminal && (
            <>
              {isRunning && (
                <Button
                  variant="outline"
                  onClick={() => handleControl("pause")}
                  disabled={controlling}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="outline"
                  onClick={() => handleControl("resume")}
                  disabled={controlling}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => handleControl("cancel")}
                disabled={controlling}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}

          {isTerminal && !isRunning && (
            <Button onClick={handleStart} disabled={starting} variant="outline">
              <Play className="mr-2 h-4 w-4" />
              Re-run Generation
            </Button>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      {hasJob && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* ── Production board ── */}
      <div className="flex flex-col gap-6">
        {scenes.map((scene) => (
          <Card key={scene.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Scene {scene.sceneNumber} — {scene.title}
                </CardTitle>
                <Badge variant="outline">{scene.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {scene.shots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shots yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {scene.shots.map((shot) => (
                    <ShotCard key={shot.id} shot={shot} />
                  ))}
                </div>
              )}

              {/* Scene-level flagged summary */}
              {scene.shots.some((s) => s.status === "NEEDS_REVIEW") && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {scene.shots.filter((s) => s.status === "NEEDS_REVIEW").length} shot(s)
                    flagged for review — check likeness results before export.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {scenes.length === 0 && (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Start generation to see the production board.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
