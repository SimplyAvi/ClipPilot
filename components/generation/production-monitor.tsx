"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, DollarSign, Loader2, Pause, Play, RefreshCw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGenerationStream, type StreamLog, type StreamTask } from "@/hooks/use-generation-stream";
import { cn } from "@/lib/utils";

export function ProductionMonitor({ projectId, projectName, themeName, mode }: { projectId: string; projectName: string; themeName: string | null; mode: string }) {
  const { job, tasks, logs, elapsed, failedTasks } = useGenerationStream(projectId);
  const [open, setOpen] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(`generation-monitor-${projectId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOpen(Boolean(parsed.isOpen));
      } catch {}
    }
  }, [projectId]);

  useEffect(() => {
    localStorage.setItem(`generation-monitor-${projectId}`, JSON.stringify({ isOpen: open, activeTab: "pipeline" }));
  }, [open, projectId]);

  const isActive = job && ["queued", "running", "paused", "cancelled", "complete", "failed"].includes(job.status);

  useEffect(() => {
    const previousPadding = document.body.style.paddingRight;
    const previousTransition = document.body.style.transition;
    if (isActive && open && window.innerWidth >= 768) {
      document.body.style.transition = "padding-right 300ms ease";
      document.body.style.paddingRight = "420px";
    } else {
      document.body.style.paddingRight = previousPadding;
      document.body.style.transition = previousTransition;
    }
    return () => {
      document.body.style.paddingRight = previousPadding;
      document.body.style.transition = previousTransition;
    };
  }, [isActive, open]);

  const stages = useMemo(() => tasks.filter((task) => !task.parentTaskId), [tasks]);
  const sceneTasks = useMemo(() => tasks.filter((task) => task.taskType === "scene_shots" || task.taskType === "visual_segment"), [tasks]);
  const remaining = job?.remainingSeconds ?? estimateRemaining(elapsed, job?.overallProgress ?? 0, job?.estimatedTotalSeconds ?? 60);

  async function control(action: "pause" | "resume" | "cancel") {
    await fetch(`/api/generation/${projectId}/${action}`, { method: "POST" });
    if (action === "cancel") setConfirmCancel(false);
  }

  async function retry(taskId: string) {
    await fetch(`/api/generation/${projectId}/retry-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
  }

  if (!isActive) return null;

  return (
    <>
      <aside className={cn("fixed right-0 top-0 z-40 flex h-screen w-full max-w-[420px] flex-col border-l bg-background shadow-2xl transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <button onClick={() => setOpen((value) => !value)} className="absolute -left-9 top-24 rounded-l-lg border bg-background p-2 shadow">
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <header className="border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                {job?.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                {job?.status === "complete" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                Generating...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{themeName ?? projectName} · {mode === "visual_narrator" ? "Visual Narrator Mode" : "Character Mode"}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Collapse</Button>
          </div>
        </header>

        <div className="space-y-4 overflow-y-auto p-4">
          <Stats elapsed={elapsed} remaining={remaining} cost={job?.totalCostActual ?? 0} progress={job?.overallProgress ?? 0} complete={job?.status === "complete"} />
          <Controls jobStatus={job?.status ?? "queued"} confirmCancel={confirmCancel} onPause={() => control("pause")} onResume={() => control("resume")} onCancel={() => setConfirmCancel(true)} onConfirmCancel={() => control("cancel")} onKeepRunning={() => setConfirmCancel(false)} />
          {failedTasks[0] && <ErrorPanel task={failedTasks[0]} failedCount={failedTasks.length} onRetry={() => retry(failedTasks[0].id)} onPause={() => control("pause")} />}
          {job?.status === "cancelled" && <CheckpointBanner job={job} tasks={tasks} projectId={projectId} />}
          {job?.status === "complete" && <CompletionCard elapsed={elapsed} cost={job.totalCostActual} projectId={projectId} />}
          <Pipeline stages={stages} tasks={tasks} />
          <SceneGrid title={mode === "visual_narrator" ? "Segments" : "Scenes"} scenes={sceneTasks} tasks={tasks} />
          <LiveLog logs={logs} autoScroll={autoScroll} setAutoScroll={setAutoScroll} />
        </div>
      </aside>

      {!open && job?.status === "running" && (
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border bg-background p-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Generating...</span>
            <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-blue-500" style={{ width: `${job.overallProgress}%` }} /></div>
            <span>{Math.round(job.overallProgress)}%</span>
            <span>{formatDuration(elapsed)}</span>
            <span>${job.totalCostActual.toFixed(2)}</span>
            <Button size="sm" onClick={() => setOpen(true)}>Open Monitor</Button>
          </div>
        </div>
      )}
    </>
  );
}

function Stats({ elapsed, remaining, cost, progress, complete }: { elapsed: number; remaining: number; cost: number; progress: number; complete: boolean }) {
  return (
    <section>
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={<Clock className="h-3.5 w-3.5" />} value={formatDuration(elapsed)} label="elapsed" />
        <Stat icon={<Clock className="h-3.5 w-3.5" />} value={complete ? "Done" : `~${formatDuration(remaining)}`} label="remaining" />
        <Stat icon={<DollarSign className="h-3.5 w-3.5" />} value={`$${cost.toFixed(2)}`} label="spent" />
        <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} value={`${Math.round(progress)}%`} label="complete" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all duration-500", complete ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-lg border p-2 text-center"><div className="flex items-center justify-center gap-1 text-xs font-semibold">{icon}{value}</div><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>;
}

function Controls({ jobStatus, confirmCancel, onPause, onResume, onCancel, onConfirmCancel, onKeepRunning }: { jobStatus: string; confirmCancel: boolean; onPause: () => void; onResume: () => void; onCancel: () => void; onConfirmCancel: () => void; onKeepRunning: () => void }) {
  if (jobStatus === "complete") return <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700">Generation Complete!</div>;
  if (jobStatus === "paused") return <div className="space-y-2"><Badge variant="secondary">Paused</Badge><p className="text-xs text-muted-foreground">Generation is paused. Current tasks will finish then stop.</p><div className="flex gap-2"><Button size="sm" onClick={onResume}><Play className="mr-2 h-4 w-4" />Resume</Button><Button size="sm" variant="destructive" onClick={onCancel}><X className="mr-2 h-4 w-4" />Cancel</Button></div></div>;
  if (confirmCancel) return <div className="rounded-lg border border-amber-300 p-3"><p className="mb-2 text-sm font-medium">Save checkpoint and cancel?</p><div className="flex gap-2"><Button size="sm" variant="destructive" onClick={onConfirmCancel}>Yes, Cancel</Button><Button size="sm" variant="outline" onClick={onKeepRunning}>Keep Running</Button></div></div>;
  return <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onPause}><Pause className="mr-2 h-4 w-4" />Pause</Button><Button size="sm" variant="destructive" onClick={onCancel}><X className="mr-2 h-4 w-4" />Cancel</Button></div>;
}

function Pipeline({ stages, tasks }: { stages: StreamTask[]; tasks: StreamTask[] }) {
  return <section><h3 className="mb-2 text-sm font-semibold">Pipeline</h3><div className="flex gap-3 overflow-x-auto pb-2">{stages.map((stage) => <StageNode key={stage.id} stage={stage} tasks={tasks} />)}</div></section>;
}

function StageNode({ stage, tasks }: { stage: StreamTask; tasks: StreamTask[] }) {
  const children = tasks.filter((task) => task.parentTaskId === stage.id);
  const progress = children.length ? children.reduce((sum, item) => sum + item.progress, 0) / children.length : stage.progress;
  const status = children.some((item) => item.status === "running") ? "running" : children.every((item) => item.status === "complete") && children.length ? "complete" : stage.status;
  return <div className={cn("min-w-28 rounded-lg border p-2 text-center text-xs", status === "running" && "border-blue-500 bg-blue-500/10", status === "complete" && "border-green-500 bg-green-500/10", status === "failed" && "border-red-500 bg-red-500/10")}><div className="text-lg">{stageIcon(stage.label)}</div><p className="mt-1 line-clamp-2 font-medium">{stage.label}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-blue-500" style={{ width: `${progress}%` }} /></div>{stage.durationSeconds && <p className="mt-1 text-muted-foreground">{stage.durationSeconds.toFixed(1)}s</p>}</div>;
}

function SceneGrid({ title, scenes, tasks }: { title: string; scenes: StreamTask[]; tasks: StreamTask[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <section><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="grid grid-cols-2 gap-2">{scenes.map((scene) => { const children = tasks.filter((task) => task.parentTaskId === scene.id); const done = children.filter((task) => task.status === "complete").length; const progress = children.length ? (done / children.length) * 100 : scene.progress; return <button key={scene.id} onClick={() => setExpanded(expanded === scene.id ? null : scene.id)} className={cn("rounded-lg border p-3 text-left text-xs", scene.status === "running" && "border-blue-500", scene.status === "complete" && "border-green-500", scene.status === "failed" && "border-red-500")}><p className="font-medium line-clamp-1">{scene.label}</p><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-muted-foreground">{done}/{children.length || 1} complete</p>{expanded === scene.id && <div className="mt-2 space-y-1">{children.map((task) => <p key={task.id} className="truncate">{statusGlyph(task.status)} {task.label} {task.durationSeconds ? `${task.durationSeconds.toFixed(1)}s` : ""}</p>)}</div>}</button>; })}</div></section>;
}

function LiveLog({ logs, autoScroll, setAutoScroll }: { logs: StreamLog[]; autoScroll: boolean; setAutoScroll: (value: boolean) => void }) {
  return <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Live Log</h3><button className="text-xs text-muted-foreground" onClick={() => setAutoScroll(!autoScroll)}>Auto-scroll: {autoScroll ? "ON" : "OFF"}</button></div><div className="h-40 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200">{logs.length === 0 ? <p className="text-zinc-500">Waiting for generation events...</p> : logs.map((log) => <p key={log.id} className={cn("whitespace-nowrap", log.level === "success" && "text-green-400", log.level === "warning" && "text-yellow-300", log.level === "error" && "text-red-400")}><span className="text-zinc-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {logIcon(log.level)} {log.message}</p>)}</div></section>;
}

function ErrorPanel({ task, failedCount, onRetry, onPause }: { task: StreamTask; failedCount: number; onRetry: () => void; onPause: () => void }) {
  return <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-medium"><AlertTriangle className="mr-1 inline h-4 w-4" />{task.label} failed</p><p className="mt-1 text-xs">{task.errorMessage}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Retry This Task</Button>{failedCount >= 3 && <Button size="sm" variant="outline" onClick={onPause}>Pause Generation</Button>}</div></div>;
}

function CheckpointBanner({ job, tasks, projectId }: { job: { overallProgress: number }; tasks: StreamTask[]; projectId: string }) {
  const completed = tasks.filter((task) => task.status === "complete").length;
  async function resumeFromCheckpoint() {
    await fetch(`/api/generation/${projectId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCheckpoint: true }),
    });
  }
  return <div className="rounded-lg border bg-muted p-3 text-sm"><p className="font-semibold"><Square className="mr-1 inline h-4 w-4" />Generation stopped at {Math.round(job.overallProgress)}%</p><p className="mt-1 text-muted-foreground">{completed} of {tasks.length} tasks completed and saved.</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={resumeFromCheckpoint}>Resume from Checkpoint</Button></div></div>;
}

function CompletionCard({ elapsed, cost, projectId }: { elapsed: number; cost: number; projectId: string }) {
  return <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900"><p className="text-lg font-semibold"><CheckCircle2 className="mr-2 inline h-5 w-5" />Generation Complete</p><p className="mt-2">Total time: {formatDuration(elapsed)}</p><p>Total cost: ${cost.toFixed(2)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/projects/${projectId}/captions`}>Continue to Captions</Link></Button><Button size="sm" asChild><Link href={`/projects/${projectId}/export`}>Go to Export</Link></Button></div></div>;
}

function estimateRemaining(elapsed: number, progress: number, fallback: number) {
  if (progress <= 0) return fallback;
  return Math.max(Math.ceil((elapsed / progress) * (100 - progress)), 10);
}
function formatDuration(seconds: number) { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return m ? `${m}m ${s}s` : `${s}s`; }
function statusGlyph(status: string) { return status === "complete" ? "✓" : status === "running" ? "⟳" : status === "failed" ? "✗" : "○"; }
function logIcon(level: string) { return level === "success" ? "✓" : level === "warning" ? "⚠" : level === "error" ? "✗" : "→"; }
function stageIcon(label: string) { if (label.includes("Character")) return "👤"; if (label.includes("Voice") || label.includes("Narrator")) return "🎙"; if (label.includes("Shot")) return "🎬"; if (label.includes("Lip")) return "👄"; if (label.includes("Music")) return "🎵"; if (label.includes("Assembly")) return "🎞"; if (label.includes("Stitch")) return "🔗"; if (label.includes("Color")) return "🎨"; if (label.includes("Export")) return "📤"; return "📄"; }
