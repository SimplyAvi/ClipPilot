"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VariantComparison } from "@/components/ui/variant-comparison";
import { Check, Edit3, Loader2, PlayCircle, RefreshCw, SplitSquareHorizontal, X } from "lucide-react";

type Preview = {
  id: string;
  testMode: string;
  status: string;
  shotsGenerated: number;
  totalShots: number;
  previewVideoPath: string | null;
  previewThumbPath: string | null;
  generationPromptUsed: string | null;
  themeModifierUsed: string | null;
  costActual: number;
  durationSeconds: number | null;
  approvedAt: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  viewUrl?: string | null;
};

type Segment = {
  id: string;
  stanzaIndex: number;
  stanzaText: string;
  visualConcept: string;
  primarySubject: string;
  movementStyle: string;
  cameraApproach: string;
  colorTemperature: string;
  emotionalQuality: string | null;
  additionalNotes: string | null;
  generationPrompt: string | null;
  generatedVideoPath: string | null;
  approvedVariantIdx: number;
  variantPaths: string | null;
  narratorAudioPath: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  status: string;
  viewUrl?: string | null;
  variantUrls?: string[];
  previews?: Preview[];
};

type Project = {
  id: string;
  name: string;
  productionMode: string;
  variantCount: number;
  theme: { id: string; name: string; visualPromptModifier: string | null } | null;
  narratorProfile: { voiceName: string | null; voiceId: string | null } | null;
  projectMusicTrack: { status: string; audioPath: string | null } | null;
};

export function VisualStoryboardClient({ project, initialSegments }: { project: Project; initialSegments: Segment[] }) {
  const [segments, setSegments] = useState(initialSegments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compareSegment, setCompareSegment] = useState<Segment | null>(null);
  const [testSegment, setTestSegment] = useState<Segment | null>(null);
  const [testMode, setTestMode] = useState<"quick" | "draft" | "full">("quick");
  const [testConcept, setTestConcept] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepted = segments.filter((segment) => segment.status === "concept_approved" || segment.status === "generated" || segment.status === "needs_review").length;
  const generated = segments.filter((segment) => segment.generatedVideoPath).length;
  const tested = segments.filter((segment) => latestPreview(segment)).length;
  const approvedTests = segments.filter((segment) => latestPreview(segment)?.approvedAt).length;
  const totalSeconds = segments.reduce((sum, segment) => sum + (segment.durationSeconds ?? 8), 0);
  const allAccepted = segments.length > 0 && accepted === segments.length;
  const heroSegment = segments.find((segment) => /climax|peak|turn|reveal|loss|decision/i.test(`${segment.emotionalQuality ?? ""} ${segment.visualConcept}`)) ?? segments[Math.floor(segments.length / 2)] ?? segments[0];

  async function accept(segment: Segment) {
    await patchSegment(segment.id, { status: "concept_approved" });
  }

  async function reviewAll() {
    for (const segment of segments) {
      if (segment.status === "concept_pending") await patchSegment(segment.id, { status: "concept_approved" });
    }
  }

  async function patchSegment(id: string, data: Partial<Segment>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/visual-narrator/segments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update segment");
      setSegments((current) => current.map((segment) => segment.id === id ? { ...segment, ...json.data } : segment));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update segment");
    } finally {
      setBusyId(null);
    }
  }

  async function alternatives(segment: Segment) {
    setBusyId(segment.id);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/alternative-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: segment.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate alternatives");
      const first = json.data.alternatives?.[0];
      if (first) {
        await patchSegment(segment.id, { ...first, status: "concept_pending" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate alternatives");
    } finally {
      setBusyId(null);
    }
  }

  async function generateVisuals() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/generate-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Visual generation failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function openTest(segment: Segment, mode: "quick" | "draft" | "full" = "quick") {
    setTestSegment(segment);
    setTestMode(mode);
    setTestConcept(segment.visualConcept);
  }

  async function runTest(segment: Segment, mode = testMode, concept = testConcept) {
    setTestingId(segment.id);
    setTestSegment(null);
    setError(null);
    const tempPreview: Preview = {
      id: `temp-${Date.now()}`,
      testMode: mode,
      status: "generating",
      shotsGenerated: 0,
      totalShots: mode === "quick" ? 1 : mode === "draft" ? 3 : project.variantCount,
      previewVideoPath: null,
      previewThumbPath: null,
      generationPromptUsed: null,
      themeModifierUsed: project.theme?.visualPromptModifier ?? null,
      costActual: testCost(mode),
      durationSeconds: null,
      approvedAt: null,
      feedback: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, previews: [tempPreview, ...(item.previews ?? [])] } : item));
    try {
      const res = await fetch(`/api/scenes/${segment.id}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMode: mode, adjustedConcept: concept && concept !== segment.visualConcept ? concept : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Test generation failed");
      const preview: Preview = {
        ...json.data.preview,
        createdAt: json.data.preview.createdAt,
        updatedAt: json.data.preview.updatedAt,
        approvedAt: json.data.preview.approvedAt,
        viewUrl: json.data.viewUrl,
      };
      setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, previews: [preview, ...(item.previews ?? []).filter((preview) => !preview.id.startsWith("temp-"))] } : item));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test generation failed";
      setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, previews: [{ ...tempPreview, status: "failed", feedback: message }, ...(item.previews ?? []).filter((preview) => !preview.id.startsWith("temp-"))] } : item));
    } finally {
      setTestingId(null);
    }
  }

  async function approvePreview(segment: Segment, preview: Preview) {
    const res = await fetch(`/api/scene-previews/${preview.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not approve preview");
      return;
    }
    setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, previews: (item.previews ?? []).map((existing) => existing.id === preview.id ? { ...existing, ...json.data } : existing) } : item));
  }

  const progressWidth = useMemo(() => `${segments.length ? Math.round((accepted / segments.length) * 100) : 0}%`, [accepted, segments.length]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="secondary">🌿 Visual Narrator Mode</Badge>
            {project.theme && <Badge variant="outline">{project.theme.name}</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{segments.length} segments · ~{Math.round(totalSeconds)}s estimated</p>
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: progressWidth }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Concepts {accepted}/{segments.length} reviewed · Generated {generated}/{segments.length}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reviewAll}>Review All Concepts</Button>
          <Button onClick={generateVisuals} disabled={!allAccepted || generating}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Generating
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold">Scene Tests</p>
            <p className="mt-1 text-sm text-muted-foreground">{tested} of {segments.length} tested · {approvedTests} approved</p>
            <div className="mt-3 flex gap-1">
              {segments.map((segment) => (
                <span key={segment.id} className={`h-2 w-5 rounded-full ${latestPreview(segment)?.approvedAt ? "bg-green-500" : latestPreview(segment) ? "bg-amber-400" : "bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={testingId !== null} onClick={async () => {
              for (const segment of segments.filter((item) => !latestPreview(item))) {
                await runTest(segment, "quick", segment.visualConcept);
              }
            }}>
              Test All Untested Scenes
            </Button>
            <Button onClick={generateVisuals} disabled={!allAccepted || generating}>
              Start Full Generation
            </Button>
          </div>
        </CardContent>
      </Card>

      {tested === 0 && heroSegment && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <p className="font-semibold">Recommended before generating</p>
          <p className="mt-2 text-sm">Test at least one scene to confirm your visual style before committing to full generation. Quick Test takes about 30 seconds and roughly $0.20.</p>
          <p className="mt-2 text-sm">Start with Segment {heroSegment.sortOrder + 1}: this looks like the script&apos;s strongest style check.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => openTest(heroSegment)}>Test Segment {heroSegment.sortOrder + 1} Now</Button>
            <Button size="sm" variant="outline" onClick={() => window.localStorage.setItem(`skip-step-${project.id}`, JSON.stringify([7]))}>I&apos;ll skip testing</Button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {segments.map((segment, index) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            index={index}
            total={segments.length}
            busyId={busyId}
            testing={testingId === segment.id}
            editingId={editingId}
            setEditingId={setEditingId}
            setSegments={setSegments}
            accept={accept}
            alternatives={alternatives}
            patchSegment={patchSegment}
            openTest={openTest}
            approvePreview={approvePreview}
            setCompareSegment={setCompareSegment}
          />
        ))}
      </div>

      {testSegment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4">
          <div className="mt-10 w-full max-w-4xl rounded-xl bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Test Segment {testSegment.sortOrder + 1}</h2>
                <p className="text-sm text-muted-foreground">{project.theme?.name ?? "No theme"} · ~{Math.round(testSegment.durationSeconds ?? 8)} seconds</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setTestSegment(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Visual Concept</p>
              <p className="mt-1 text-muted-foreground">{testSegment.visualConcept}</p>
              <p className="mt-2 text-xs text-muted-foreground">Movement: {testSegment.movementStyle} · Camera: {testSegment.cameraApproach} · Color: {testSegment.colorTemperature}</p>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Tweak the concept (optional)</label>
              <Textarea value={testConcept} onChange={(event) => setTestConcept(event.target.value)} rows={4} />
              <p className="mt-1 text-xs text-muted-foreground">Changes here are only used for this test.</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(["quick", "draft", "full"] as const).map((mode) => (
                <button key={mode} onClick={() => setTestMode(mode)} className={`rounded-lg border p-4 text-left ${testMode === mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <p className="font-semibold">{modeLabel(mode)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{mode === "quick" ? "1 hero shot · no audio" : mode === "draft" ? "3 key shots · rough flow" : "Complete scene preview"}</p>
                  <p className="mt-3 text-sm font-medium">~${testCost(mode).toFixed(2)}</p>
                </button>
              ))}
            </div>
            {project.theme?.visualPromptModifier && (
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Theme modifier applied: &quot;{project.theme.visualPromptModifier.slice(0, 90)}...&quot;</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTestSegment(null)}>Cancel</Button>
              <Button onClick={() => runTest(testSegment)}>Generate {modeLabel(testMode)} (~${testCost(testMode).toFixed(2)})</Button>
            </div>
          </div>
        </div>
      )}

      {allAccepted && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold">Ready to generate</p>
              <p className="text-sm text-muted-foreground">
                {segments.length} visual segments (~{Math.round(totalSeconds)} seconds) · Narrator voice: {project.narratorProfile?.voiceName ?? "not set yet"} · Music: {project.projectMusicTrack?.audioPath ? "configured" : "not configured yet"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link href={`/projects/${project.id}/narrator`}>Configure Narrator</Link></Button>
              <Button variant="outline" asChild><Link href={`/projects/${project.id}/project-music`}>Configure Music</Link></Button>
              <Button onClick={generateVisuals}>Generate Visuals First</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {compareSegment && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background/95 p-6">
          <div className="mx-auto max-w-6xl">
            <Button variant="outline" className="mb-4" onClick={() => setCompareSegment(null)}>Close</Button>
            {compareSegment.narratorAudioPath && <p className="mb-3 text-sm text-muted-foreground">Narrator audio is available for this segment. Play it alongside each variant while comparing.</p>}
            <VariantComparison
              label={`Segment ${compareSegment.sortOrder + 1}`}
              variants={compareSegment.variantUrls ?? []}
              approvedIndex={compareSegment.approvedVariantIdx}
              onApprove={(index) => patchSegment(compareSegment.id, { approvedVariantIdx: index, generatedVideoPath: parseVariantPaths(compareSegment.variantPaths)[index], status: "generated" })}
              onRegenerate={() => generateVisuals()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentCard({
  segment,
  index,
  total,
  busyId,
  testing,
  editingId,
  setEditingId,
  setSegments,
  accept,
  alternatives,
  patchSegment,
  openTest,
  approvePreview,
  setCompareSegment,
}: {
  segment: Segment;
  index: number;
  total: number;
  busyId: string | null;
  testing: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
  accept: (segment: Segment) => Promise<void>;
  alternatives: (segment: Segment) => Promise<void>;
  patchSegment: (id: string, data: Partial<Segment>) => Promise<void>;
  openTest: (segment: Segment, mode?: "quick" | "draft" | "full") => void;
  approvePreview: (segment: Segment, preview: Preview) => Promise<void>;
  setCompareSegment: (segment: Segment) => void;
}) {
  const preview = latestPreview(segment);
  const approved = Boolean(preview?.approvedAt);
  const conceptAccepted = segment.status === "concept_approved" || segment.status === "generated" || segment.status === "needs_review";

  return (
    <Card id={`segment-${segment.id}`} className={approved ? "border-green-500/70 scroll-mt-6" : segment.status === "needs_review" ? "border-amber-500/70 scroll-mt-6" : segment.status !== "concept_pending" ? "border-green-500/50 scroll-mt-6" : "scroll-mt-6"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Segment {index + 1} of {total}</CardTitle>
          <div className="flex items-center gap-2">
            {approved && <Badge className="bg-green-600">Test Approved</Badge>}
            {segment.status === "needs_review" && <Badge className="bg-amber-500 text-white">Needs Review</Badge>}
            {conceptAccepted && !approved && segment.status !== "needs_review" && <Badge variant="secondary">Concept Accepted</Badge>}
            {preview && !approved && preview.status === "complete" && <Badge variant="secondary">Awaiting approval</Badge>}
            <Badge variant="outline">{Math.round(segment.durationSeconds ?? 8)} sec estimate</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {testing || preview?.status === "generating" ? (
          <div className="rounded-lg border bg-muted p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin" />Generating {modeLabel((preview?.testMode as "quick" | "draft" | "full") ?? "quick")}...</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full w-2/3 animate-pulse bg-blue-500" /></div>
            <p className="mt-2 text-xs text-muted-foreground">Sending to provider · Estimated ~30 seconds · ~${testCost((preview?.testMode as "quick" | "draft" | "full") ?? "quick").toFixed(2)}</p>
          </div>
        ) : preview?.status === "failed" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p>Test generation failed — {preview.feedback ?? "Try again."}</p>
            <Button size="sm" className="mt-2" variant="outline" onClick={() => openTest(segment)}>Try Again</Button>
          </div>
        ) : preview?.viewUrl ? (
          <div className={`rounded-lg border p-2 ${approved ? "border-green-500 bg-green-50" : ""}`}>
            <div className="overflow-hidden rounded-md bg-black">
              {isVideo(preview.previewVideoPath) ? (
                <video src={preview.viewUrl} controls className="aspect-video w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.viewUrl} alt={`Segment ${index + 1} test preview`} className="aspect-video w-full object-contain" />
              )}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <p>{modeLabel(preview.testMode as "quick" | "draft" | "full")} · Cost: ${preview.costActual.toFixed(2)} · {preview.durationSeconds ? `${Math.round(preview.durationSeconds)} seconds` : "Complete"}</p>
              {preview.generationPromptUsed && <details className="text-xs text-muted-foreground"><summary>Prompt used</summary><p className="mt-1 whitespace-pre-wrap">{preview.generationPromptUsed}</p></details>}
              <div className="flex flex-wrap gap-2">
                {!approved && <Button size="sm" onClick={() => approvePreview(segment, preview)}><Check className="mr-2 h-4 w-4" />Looks Perfect</Button>}
                <Button size="sm" variant="outline" onClick={() => openTest(segment)}>Adjust & Retry</Button>
                <Button size="sm" variant="outline" onClick={() => openTest(segment, "draft")}>Try Draft Preview</Button>
              </div>
            </div>
          </div>
        ) : segment.viewUrl ? (
          <div className={`rounded-lg border p-2 ${segment.status === "needs_review" ? "border-amber-400 bg-amber-50" : "bg-black"}`}>
            <div className="overflow-hidden rounded-md bg-black">
              {isVideo(segment.generatedVideoPath) ? (
                <video src={segment.viewUrl} controls className="aspect-video w-full" />
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={segment.viewUrl} alt={`Segment ${index + 1}`} className="aspect-video w-full object-contain" />
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    Still image generated
                  </span>
                </div>
              )}
            </div>
            {segment.status === "needs_review" && (
              <div className="mt-3 rounded-md bg-background p-3 text-sm">
                <p className="font-medium text-amber-900">Generated visual needs review</p>
                <p className="mt-1 text-muted-foreground">Approve this visual to use it in the final assembly, or compare/regenerate if it is not right.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => patchSegment(segment.id, { status: "generated" })}>
                    <Check className="mr-2 h-4 w-4" />Approve This Visual
                  </Button>
                  {(segment.variantUrls?.length ?? 0) > 1 && (
                    <Button size="sm" variant="outline" onClick={() => setCompareSegment(segment)}>
                      <SplitSquareHorizontal className="mr-2 h-4 w-4" />Compare Variants
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openTest(segment)}>
                    <RefreshCw className="mr-2 h-4 w-4" />Regenerate / Test Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Stanza Text</p>
          <blockquote className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{segment.stanzaText}</blockquote>
        </div>

        {editingId === segment.id ? (
          <div className="space-y-3">
            <Textarea value={segment.visualConcept} onChange={(event) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, visualConcept: event.target.value } : item))} rows={4} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={segment.primarySubject} onChange={(event) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, primarySubject: event.target.value } : item))} />
              <Input value={segment.movementStyle} onChange={(event) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, movementStyle: event.target.value } : item))} />
              <Input value={segment.cameraApproach} onChange={(event) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, cameraApproach: event.target.value } : item))} />
              <Input value={segment.colorTemperature} onChange={(event) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, colorTemperature: event.target.value } : item))} />
            </div>
            <Button size="sm" onClick={() => { void patchSegment(segment.id, segment); setEditingId(null); }}>Save Concept</Button>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Visual Concept</p>
              <p className="text-sm leading-relaxed">{segment.visualConcept}</p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Movement:</span> {segment.movementStyle}</p>
              <p><span className="text-muted-foreground">Camera:</span> {segment.cameraApproach}</p>
              <p><span className="text-muted-foreground">Color:</span> {segment.colorTemperature}</p>
              <p><span className="text-muted-foreground">Feel:</span> {segment.emotionalQuality ?? "Not set"}</p>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => accept(segment)} disabled={busyId === segment.id || conceptAccepted} variant={conceptAccepted ? "outline" : "default"}>
            <Check className="mr-2 h-4 w-4" />{conceptAccepted ? "Concept Accepted" : "Accept This Concept"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openTest(segment)} disabled={busyId === segment.id}>
            <PlayCircle className="mr-2 h-4 w-4" />{preview ? "Re-test" : "Test This Scene"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => alternatives(segment)} disabled={busyId === segment.id}>
            <RefreshCw className="mr-2 h-4 w-4" />Get 3 Alternatives
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditingId(editingId === segment.id ? null : segment.id)}>
            <Edit3 className="mr-2 h-4 w-4" />Edit Manually
          </Button>
          {(segment.variantUrls?.length ?? 0) > 1 && (
            <Button size="sm" variant="outline" onClick={() => setCompareSegment(segment)}>
              <SplitSquareHorizontal className="mr-2 h-4 w-4" />Compare {segment.variantUrls?.length} Variants
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parseVariantPaths(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function latestPreview(segment: Segment): Preview | null {
  return segment.previews?.[0] ?? null;
}

function modeLabel(mode: "quick" | "draft" | "full") {
  if (mode === "quick") return "Quick Test";
  if (mode === "draft") return "Draft Preview";
  return "Full Scene";
}

function testCost(mode: "quick" | "draft" | "full") {
  if (mode === "quick") return 0.18;
  if (mode === "draft") return 0.72;
  return 3.5;
}

function isVideo(path: string | null) {
  return Boolean(path?.match(/\.(mp4|webm|mov)$/i));
}
