"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Clock, DollarSign, RotateCcw } from "lucide-react";

type NextStep = {
  stepNumber: number;
  totalSteps: number;
  completionPercent: number;
  category: string;
  title: string;
  description: string;
  whyNow: string;
  actionLabel: string;
  actionUrl: string;
  estimatedTime: string;
  estimatedCost: string;
  isBlocking: boolean;
  recentActivity: Array<{ label: string; completedAt: string; icon: string }>;
};

export function NextStepBanner({ projectId }: { projectId: string }) {
  const [step, setStep] = useState<NextStep | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`next-step-collapsed-${projectId}`);
    setCollapsed(saved === "true");
    const savedSkipped = localStorage.getItem(`skip-step-${projectId}`);
    if (savedSkipped) setSkipped(JSON.parse(savedSkipped));
  }, [projectId]);

  useEffect(() => {
    const query = skipped.length ? `?skip=${skipped.join(",")}` : "";
    fetch(`/api/projects/${projectId}/next-step${query}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.data) throw new Error("No next step");
        setStep(json.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [projectId, skipped]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(`next-step-collapsed-${projectId}`, String(next));
  }

  function skipStep() {
    if (!step || step.isBlocking) return;
    const next = Array.from(new Set([...skipped, step.stepNumber]));
    setSkipped(next);
    localStorage.setItem(`skip-step-${projectId}`, JSON.stringify(next));
  }

  function clearSkipped() {
    setSkipped([]);
    localStorage.removeItem(`skip-step-${projectId}`);
  }

  const isComplete = step?.category === "complete";
  const isGenerating = step?.category === "generating";
  const border = useMemo(() => {
    if (isComplete) return "border-l-green-500";
    if (isGenerating) return "border-l-blue-500";
    return step?.isBlocking ? "border-l-amber-500" : "border-l-blue-500";
  }, [isComplete, isGenerating, step?.isBlocking]);

  if (failed) {
    return (
      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">Continue working on this project</p>
          <Button asChild><Link href={`/projects/${projectId}/analysis`}>View All Sections</Link></Button>
        </div>
      </div>
    );
  }

  if (!step) {
    return <div className="mb-6 h-28 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <section className={cn("mb-6 rounded-xl border border-l-4 bg-card p-4 shadow-sm", border, isGenerating && "animate-pulse")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Step {step.stepNumber} of {step.totalSteps}</span>
            <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full", isComplete ? "bg-green-500" : "bg-blue-500")} style={{ width: `${step.completionPercent}%` }} />
            </div>
            <span className="text-muted-foreground">{step.completionPercent}% complete</span>
          </div>
          {collapsed ? (
            <p className="mt-2 truncate text-sm font-semibold">Next: {step.title}</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <Badge variant={step.isBlocking ? "secondary" : "outline"}>{step.isBlocking ? "Required" : "Not blocking"}</Badge>
                <h2 className="mt-2 text-lg font-semibold">NEXT: {step.title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{step.whyNow}</p>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{step.estimatedTime}</span>
                <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" />{step.estimatedCost}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild><Link href={step.actionUrl}>{step.actionLabel}</Link></Button>
                {!step.isBlocking && !isComplete && <Button variant="ghost" onClick={skipStep}>Skip this step</Button>}
                {skipped.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSkipped}>
                    <RotateCcw className="mr-2 h-4 w-4" />Unskip {skipped.length} step{skipped.length === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
              {step.recentActivity.length > 0 && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Recent:</p>
                  {step.recentActivity.map((item) => (
                    <p key={`${item.label}-${item.completedAt}`}>{item.label} · {relativeTime(item.completedAt)}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button className="rounded-md p-1 hover:bg-muted" onClick={toggleCollapsed} aria-label={collapsed ? "Expand next step" : "Collapse next step"}>
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
    </section>
  );
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
