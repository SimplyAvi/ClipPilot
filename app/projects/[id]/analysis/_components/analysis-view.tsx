"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  Clock,
  MapPin,
  Users,
  Clapperboard,
  BarChart2,
  FileText,
  Zap,
} from "lucide-react";
import type { ScriptAnalysis, ScriptScene } from "@/lib/prompts/script-analysis";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

const DRAMATIC_COLORS: Record<string, string> = {
  hook: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  setup: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  escalation: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  climax: "bg-red-500/10 text-red-600 dark:text-red-400",
  resolution: "bg-green-500/10 text-green-700 dark:text-green-400",
  bridge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const SHOT_COLORS: Record<string, string> = {
  wide: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  medium: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "close-up": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  insert: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  reaction: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  "over-shoulder": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  protagonist: "default",
  antagonist: "secondary",
  supporting: "outline",
  minor: "outline",
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {init}
    </span>
  );
}

// ─── Scene card ───────────────────────────────────────────────────────────────

function SceneCard({ scene }: { scene: ScriptScene }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Scene number + title */}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {scene.sceneNumber}
              </span>
              <div>
                <p className="font-semibold leading-snug">{scene.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {scene.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {fmtSec(scene.estimatedDurationSeconds)}
                  </span>
                  <span className="capitalize">{scene.timeOfDay}</span>
                  <span className="italic">{scene.emotionalTone}</span>
                </div>
              </div>
            </div>

            {/* Badges + expand */}
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  DRAMATIC_COLORS[scene.dramaticFunction] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {scene.dramaticFunction}
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Characters */}
          {scene.charactersPresent.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {scene.charactersPresent.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  <Initials name={name} />
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Density row */}
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
            <span>Dialogue: <span className="font-medium capitalize text-foreground/80">{scene.dialogueDensity}</span></span>
            <span>Action: <span className="font-medium capitalize text-foreground/80">{scene.actionDensity}</span></span>
            <span>{scene.beats.length} beat{scene.beats.length !== 1 ? "s" : ""}</span>
          </div>
        </CardHeader>
      </button>

      {/* Beats — expanded */}
      {open && (
        <CardContent className="border-t pt-4">
          <div className="flex flex-col gap-3">
            {scene.beats.map((beat) => (
              <div key={beat.beatNumber} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {beat.beatNumber}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        SHOT_COLORS[beat.suggestedShotType] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {beat.suggestedShotType}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtSec(beat.estimatedDurationSeconds)}</span>
                  </div>
                  <p className="text-foreground/80">{beat.description}</p>
                  {beat.emotionalShift && (
                    <p className="mt-0.5 text-xs text-muted-foreground italic">↑ {beat.emotionalShift}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

type RuntimeKey = "suggested" | "short" | "medium" | "long";

const RUNTIME_TABS: { key: RuntimeKey; label: string }[] = [
  { key: "suggested", label: "Suggested" },
  { key: "short", label: "Short" },
  { key: "medium", label: "Medium" },
  { key: "long", label: "Long" },
];

interface Props {
  projectId: string;
  projectName: string;
  analysis: ScriptAnalysis;
  scriptContent: string;
}

export function AnalysisView({ projectId, projectName, analysis }: Props) {
  const [runtimeTab, setRuntimeTab] = useState<RuntimeKey>("suggested");
  const rec = analysis.runtimeRecommendation;

  const totalDurationSec = analysis.scenes.reduce(
    (sum, s) => sum + s.estimatedDurationSeconds,
    0
  );

  // Complexity bar fill (1-10 scale)
  const complexityPct = (analysis.narrativeComplexityScore / 10) * 100;
  const complexityColor =
    analysis.narrativeComplexityScore <= 3
      ? "bg-green-500"
      : analysis.narrativeComplexityScore <= 6
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Header ── */}
      <div className="mb-8">
        <p className="mb-1 text-sm text-muted-foreground">Script Analysis</p>
        <h1 className="text-3xl font-bold tracking-tight">{projectName}</h1>
        {analysis.title && analysis.title !== projectName && (
          <p className="mt-1 text-lg text-muted-foreground">&ldquo;{analysis.title}&rdquo;</p>
        )}
        {analysis.logline && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{analysis.logline}</p>
        )}
      </div>

      {/* ── Content warnings ── */}
      {analysis.contentWarnings.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">Content warnings:</span>
          {analysis.contentWarnings.map((w) => (
            <span
              key={w}
              className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-400"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ── Overview stats ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <Clapperboard className="h-4 w-4 text-primary" />
          <p className="mt-1 text-xl font-bold">{analysis.totalScenes}</p>
          <p className="text-xs text-muted-foreground">Scenes</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <Clock className="h-4 w-4 text-primary" />
          <p className="mt-1 text-xl font-bold">{fmtSec(totalDurationSec)}</p>
          <p className="text-xs text-muted-foreground">Est. Runtime</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <FileText className="h-4 w-4 text-primary" />
          <p className="mt-1 text-xl font-bold">{analysis.estimatedWordCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Word Count</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <BarChart2 className="h-4 w-4 text-primary" />
          <p className="mt-1 text-xl font-bold">{analysis.narrativeComplexityScore}/10</p>
          <p className="text-xs text-muted-foreground">Complexity</p>
        </div>
      </div>

      {/* Complexity bar */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Narrative Complexity</span>
          <span className="text-muted-foreground">{analysis.narrativeComplexityScore}/10</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${complexityColor}`}
            style={{ width: `${complexityPct}%` }}
          />
        </div>
        {analysis.complexityReasoning && (
          <p className="text-xs text-muted-foreground">{analysis.complexityReasoning}</p>
        )}
      </div>

      {/* ── Runtime recommendation ── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Runtime Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {RUNTIME_TABS.map((tab) => {
              const isSuggested =
                tab.key === "suggested" ||
                tab.key === rec.suggested.toLowerCase();
              const isActive = runtimeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRuntimeTab(tab.key)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.key === "suggested" && (
                    <Star className="h-3 w-3 text-yellow-500 shrink-0" />
                  )}
                  {tab.label}
                  {tab.key !== "suggested" &&
                    tab.key === rec.suggested.toLowerCase() && (
                      <span className="ml-0.5 text-xs text-yellow-500">★</span>
                    )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {runtimeTab === "suggested" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge>{rec.suggested}</Badge>
                <span className="text-sm font-medium">
                  ~{rec[rec.suggested.toLowerCase() as "short" | "medium" | "long"].estimatedMinutes} min
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
            </div>
          )}
          {runtimeTab === "short" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">~{rec.short.estimatedMinutes} min</p>
              <p className="text-sm text-muted-foreground">{rec.short.tradeoffs}</p>
            </div>
          )}
          {runtimeTab === "medium" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">~{rec.medium.estimatedMinutes} min</p>
              <p className="text-sm text-muted-foreground">{rec.medium.tradeoffs}</p>
            </div>
          )}
          {runtimeTab === "long" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">~{rec.long.estimatedMinutes} min</p>
              <p className="text-sm text-muted-foreground">{rec.long.tradeoffs}</p>
            </div>
          )}

          <Button variant="outline" size="sm" className="self-start" disabled>
            Continue with {runtimeTab === "suggested" ? rec.suggested : runtimeTab.charAt(0).toUpperCase() + runtimeTab.slice(1)} version
          </Button>
        </CardContent>
      </Card>

      {/* ── Characters ── */}
      {analysis.characters.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5" />
            Characters Detected
            <span className="text-sm font-normal text-muted-foreground">
              ({analysis.characters.length})
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {analysis.characters.map((char) => (
              <Card key={char.name}>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Initials name={char.name} />
                      <span className="font-semibold text-sm">{char.name}</span>
                    </div>
                    <Badge variant={ROLE_VARIANT[char.role]} className="capitalize text-xs">
                      {char.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{char.estimatedSpeakingLines} speaking line{char.estimatedSpeakingLines !== 1 ? "s" : ""}</span>
                    <span className="capitalize">Emotional range: {char.emotionalRange}</span>
                  </div>
                  {char.scenesAppearingIn.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {char.scenesAppearingIn.map((n) => (
                        <span
                          key={n}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Scene breakdown ── */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Clapperboard className="h-5 w-5" />
          Scene Breakdown
          <span className="text-sm font-normal text-muted-foreground">
            ({analysis.scenes.length} scene{analysis.scenes.length !== 1 ? "s" : ""})
          </span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">Click a scene to expand its beat structure.</p>
        <div className="flex flex-col gap-3">
          {analysis.scenes.map((scene) => (
            <SceneCard key={scene.sceneNumber} scene={scene} />
          ))}
        </div>
      </div>

      {/* Production notes */}
      {analysis.productionNotes && (
        <Card className="mb-8 border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Production Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.productionNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Actions ── */}
      <div className="flex justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href="/projects/new">
            <FileText className="mr-2 h-4 w-4" />
            Edit Script
          </Link>
        </Button>

        <div className="relative group">
          <Button disabled>
            Continue to Characters
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block border">
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
