"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { CheckCircle2, Clock, Loader2, Mic2, Music2, Palette, Play, Video, Wand2 } from "lucide-react";

type SegmentSummary = {
  id: string;
  label: string;
  status: string;
  hasVisual: boolean;
  hasAudio: boolean;
};

type VisualNarratorGenerateBoardProps = {
  projectId: string;
  projectName: string;
  themeName: string | null;
  segments: SegmentSummary[];
  narratorConfigured: boolean;
  musicConfigured: boolean;
};

export function VisualNarratorGenerateBoard({
  projectId,
  projectName,
  themeName,
  segments,
  narratorConfigured,
  musicConfigured,
}: VisualNarratorGenerateBoardProps) {
  const { job, tasks, logs } = useGenerationStream(projectId);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visualTasks = tasks.filter((task) => task.taskType === "visual_segment");
  const audioTasks = tasks.filter((task) => task.taskType === "narrator_segment");
  const reviewSegments = segments.filter((segment) => segment.status === "needs_review");
  const visualDone = visualTasks.length
    ? visualTasks.filter((task) => task.status === "complete").length
    : segments.filter((segment) => segment.hasVisual).length;
  const audioDone = audioTasks.length
    ? audioTasks.filter((task) => task.status === "complete").length
    : segments.filter((segment) => segment.hasAudio).length;
  const isRunning = job?.status === "running" || job?.status === "queued";
  const isComplete = job?.status === "complete";

  const statusLabel = useMemo(() => {
    if (job?.status) return job.status;
    if (segments.every((segment) => segment.hasVisual && segment.hasAudio)) return "ready for assembly";
    return "ready";
  }, [job?.status, segments]);

  async function startGeneration() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/generation/${projectId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCheckpoint: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start generation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start generation");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wand2 className="h-5 w-5 text-blue-600" />
                Visual Narrator Production
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {projectName} {themeName ? `· Theme: ${themeName}` : ""}
              </p>
            </div>
            <Badge variant={isComplete ? "default" : isRunning ? "secondary" : "outline"} className="capitalize">
              {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard icon={<Palette className="h-4 w-4" />} label="Concepts" value={`${segments.length}/${segments.length}`} tone="green" />
            <StatCard icon={<Video className="h-4 w-4" />} label="Visuals" value={`${visualDone}/${segments.length}`} tone={visualDone ? "blue" : "neutral"} />
            <StatCard icon={<Mic2 className="h-4 w-4" />} label="Narrator" value={`${audioDone}/${segments.length}`} tone={audioDone ? "blue" : "neutral"} />
            <StatCard icon={<Music2 className="h-4 w-4" />} label="Music" value={musicConfigured ? "Ready" : "Optional"} tone={musicConfigured ? "green" : "neutral"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={startGeneration} disabled={starting || isRunning}>
              {starting || isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {isRunning ? "Generation Running" : "Start Visual Narrator Generation"}
            </Button>
            <Button variant="outline" asChild><Link href={`/projects/${projectId}/visual-storyboard`}>Open Storyboard</Link></Button>
            <Button variant="outline" asChild><Link href={`/projects/${projectId}/narrator`}>Narrator</Link></Button>
            <Button variant="outline" asChild><Link href={`/projects/${projectId}/project-music`}>Music Score</Link></Button>
            {reviewSegments.length > 0 && (
              <Button variant="default" asChild>
                <Link href={`/projects/${projectId}/visual-storyboard?review=generated#segment-${reviewSegments[0].id}`}>
                  Review Generated Visuals
                </Link>
              </Button>
            )}
          </div>

          {reviewSegments.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {reviewSegments.length} generated segment{reviewSegments.length === 1 ? "" : "s"} need review. Open the Storyboard to approve the current visual or choose a different variant.
            </p>
          )}
          {!narratorConfigured && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Narrator voice is not configured. Visuals can still generate, but narrator audio will pause with a clear warning.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <StageRow label="Visual Generation" count={`${visualDone}/${segments.length}`} active={isRunning && visualTasks.some((task) => task.status === "running")} complete={visualDone === segments.length && segments.length > 0} />
          <StageRow label="Narrator Audio" count={`${audioDone}/${segments.length}`} active={isRunning && audioTasks.some((task) => task.status === "running")} complete={audioDone === segments.length && segments.length > 0} />
          <StageRow label="Music Score" count={musicConfigured ? "ready" : "optional"} active={false} complete={musicConfigured} />
          <StageRow label="Assembly Manifest" count={job?.currentStageLabel ?? "waiting"} active={job?.currentStageLabel === "Assembly & Stitch"} complete={isComplete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Segments</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((segment, index) => {
              const visualTask = visualTasks.find((task) => task.metadata?.includes(segment.id));
              const audioTask = audioTasks.find((task) => task.metadata?.includes(segment.id));
              return (
                <div key={segment.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Segment {index + 1}</p>
                    <Badge variant="outline">{segment.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{segment.label}</p>
                  {segment.status === "needs_review" && (
                    <Button className="mt-3 w-full" size="sm" asChild>
                      <Link href={`/projects/${projectId}/visual-storyboard?review=generated#segment-${segment.id}`}>
                        Review This Segment
                      </Link>
                    </Button>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <MiniState label="Visual" done={segment.hasVisual || visualTask?.status === "complete"} running={visualTask?.status === "running"} />
                    <MiniState label="Audio" done={segment.hasAudio || audioTask?.status === "complete"} running={audioTask?.status === "running"} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Latest Monitor Log</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generation events yet. Press Start Visual Narrator Generation to begin.</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 6).map((log) => (
                <p key={log.id} className="text-sm">
                  <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>{" "}
                  {log.level === "success" ? "✓" : log.level === "error" ? "✕" : "→"} {log.message}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "green" | "blue" | "neutral" }) {
  const color = tone === "green" ? "border-green-200 bg-green-50" : tone === "blue" ? "border-blue-200 bg-blue-50" : "bg-background";
  return <div className={`rounded-lg border p-3 ${color}`}><div className="flex items-center gap-2 text-sm font-semibold">{icon}{value}</div><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}

function StageRow({ label, count, active, complete }: { label: string; count: string; active: boolean; complete: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span className="flex items-center gap-2">{complete ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}{label}</span><span className="text-muted-foreground">{count}</span></div>;
}

function MiniState({ label, done, running }: { label: string; done: boolean; running: boolean }) {
  return <div className="flex items-center justify-between rounded bg-muted px-2 py-1"><span>{label}</span><span>{done ? "✓ Done" : running ? "Generating..." : "Waiting"}</span></div>;
}
