"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Edit3,
  BarChart2,
  FileText,
} from "lucide-react";

// ─── Option lists (shared with /projects/new) ────────────────────────────────

const GENRES = [
  "action","comedy","drama","documentary","thriller",
  "horror","romance","sci-fi","fantasy","educational","lifestyle","other",
];
const TONES = [
  "serious","humorous","inspirational","educational","emotional",
  "suspenseful","lighthearted","energetic","calm","other",
];
const PLATFORMS = [
  { value: "youtube-shorts", label: "YouTube Shorts" },
  { value: "instagram-reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
];
const DURATIONS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "60 seconds" },
  { value: 90, label: "90 seconds" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Beat {
  beatNumber: number;
  label: string;
  description: string;
  estimatedDurationSec: number;
}

type Step = 1 | 2 | 3 | 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateRuntime(wordCount: number): number {
  // Average speaking + reading pace for short-form: ~130 wpm
  // Script lines also include silent action — add 30% overhead
  return Math.round((wordCount / 130) * 60 * 1.3);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  const labels = ["Logline", "Structure", "Script", "Review"];
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const step = (i + 1) as Step;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-background text-primary"
                    : "border-muted-foreground/30 bg-background text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={`mt-1 text-xs ${
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`mb-4 h-0.5 w-10 sm:w-16 mx-1 transition-colors ${
                  done ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function IdeaWizard() {
  const router = useRouter();

  // ── Project metadata (collected before step 1) ──
  const [projectName, setProjectName] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [targetDurationSec, setTargetDurationSec] = useState<number>(60);
  const [metaError, setMetaError] = useState<string | null>(null);

  // ── Step state ──
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: Logline ──
  const [rawIdea, setRawIdea] = useState("");
  const [logline, setLogline] = useState("");
  const [generatingLogline, setGeneratingLogline] = useState(false);
  const [loglineError, setLoglineError] = useState<string | null>(null);

  // ── Step 2: Structure ──
  const [beats, setBeats] = useState<Beat[]>([]);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // ── Step 3: Script ──
  const [scriptText, setScriptText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Step 4: Review ──
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // ── Validate metadata ──
  function validateMeta(): boolean {
    if (!projectName.trim()) { setMetaError("Project name is required."); return false; }
    if (!genre) { setMetaError("Please select a genre."); return false; }
    if (!tone) { setMetaError("Please select a tone."); return false; }
    if (!platform) { setMetaError("Please select a target platform."); return false; }
    setMetaError(null);
    return true;
  }

  // ─── Step 1: Generate Logline ─────────────────────────────────────────────

  async function handleGenerateLogline() {
    if (!validateMeta()) return;
    if (!rawIdea.trim()) { setLoglineError("Please describe your idea first."); return; }
    setGeneratingLogline(true);
    setLoglineError(null);
    try {
      const res = await fetch("/api/scripts/generate-logline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawIdea, genre, tone, platform, targetDurationSec }),
      });
      const json = await res.json();
      if (!res.ok) { setLoglineError(json.error ?? "Generation failed"); return; }
      setLogline(json.data.logline);
    } catch {
      setLoglineError("Network error — is the dev server running?");
    } finally {
      setGeneratingLogline(false);
    }
  }

  function goToStep2() {
    if (!validateMeta()) return;
    if (!logline.trim()) { setLoglineError("Generate or write a logline first."); return; }
    setLoglineError(null);
    setStep(2);
  }

  // ─── Step 2: Generate Structure ───────────────────────────────────────────

  async function handleGenerateStructure() {
    setGeneratingStructure(true);
    setStructureError(null);
    try {
      const res = await fetch("/api/scripts/generate-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logline, genre, tone, platform, targetDurationSec }),
      });
      const json = await res.json();
      if (!res.ok) { setStructureError(json.error ?? "Structure generation failed"); return; }
      setBeats(json.data.beats);
    } catch {
      setStructureError("Network error");
    } finally {
      setGeneratingStructure(false);
    }
  }

  function updateBeat(index: number, field: keyof Beat, value: string | number) {
    setBeats((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  }

  function goToStep3() {
    if (beats.length === 0) { setStructureError("Generate a structure first."); return; }
    setStructureError(null);
    setStep(3);
  }

  // ─── Step 3: Expand Script ────────────────────────────────────────────────

  const handleExpandScript = useCallback(async () => {
    setStreaming(true);
    setScriptText("");
    setScriptError(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scripts/expand-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logline, beats, genre, tone, platform, targetDurationSec }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({ error: "Stream failed" }));
        setScriptError(json.error ?? "Script generation failed");
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;

          // Try to parse as error object
          try {
            const obj = JSON.parse(payload);
            if (obj.error) { setScriptError(obj.error); return; }
          } catch {
            // Not JSON — it's a text chunk (newlines were escaped)
            const chunk = payload.replace(/\\n/g, "\n");
            accumulated += chunk;
            setScriptText(accumulated);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setScriptError(err instanceof Error ? err.message : "Stream error");
    } finally {
      setStreaming(false);
    }
  }, [logline, beats, genre, tone, platform, targetDurationSec]);

  function stopStream() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function goToStep4() {
    if (!scriptText.trim()) { setScriptError("Write the script first."); return; }
    setScriptError(null);
    setStep(4);
  }

  // ─── Step 4: Analyze ─────────────────────────────────────────────────────

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          scriptText,
          genre,
          tone,
          platform,
          targetDuration: String(targetDurationSec),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAnalyzeError(json.error ?? "Analysis failed");
        return;
      }
      router.push(`/projects/${json.data.projectId}/analysis`);
    } catch {
      setAnalyzeError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }

  // ─── Render: metadata header (always visible) ────────────────────────────

  const wordCount = countWords(scriptText);
  const estimatedSec = estimateRuntime(wordCount);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Start from Idea</h1>
        <p className="mt-1 text-muted-foreground">
          Describe your concept and let Claude write the script step by step.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center py-2">
        <StepIndicator current={step} total={4} />
      </div>

      {/* ── Project metadata (always shown) ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Project Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="project-name" className="text-xs">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g. The Last Barista"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1"
              disabled={step > 1}
            />
          </div>
          <div>
            <Label className="text-xs">Genre</Label>
            <Select value={genre} onValueChange={setGenre} disabled={step > 1}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone} disabled={step > 1}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={setPlatform} disabled={step > 1}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Target Duration</Label>
            <Select
              value={String(targetDurationSec)}
              onValueChange={(v) => setTargetDurationSec(Number(v))}
              disabled={step > 1}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {metaError && (
            <div className="sm:col-span-2">
              <ErrorBanner message={metaError} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Logline
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">1</span>
              Logline
            </CardTitle>
            <CardDescription>
              Describe your idea in 1–3 sentences, then let Claude polish it into a single compelling logline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="raw-idea" className="text-xs">Your idea</Label>
              <Textarea
                id="raw-idea"
                placeholder="A tired chef discovers that every dish she cooks has a strange effect on whoever eats it — starting with herself…"
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                rows={4}
                className="mt-1 resize-none"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {rawIdea.length} / 1000 characters
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateLogline}
              disabled={generatingLogline || !rawIdea.trim()}
            >
              {generatingLogline ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Logline
            </Button>

            {logline && (
              <div className="space-y-2">
                <Label htmlFor="logline" className="text-xs">Logline — edit freely</Label>
                <Textarea
                  id="logline"
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  rows={3}
                  className="mt-1 resize-none border-primary/40 bg-primary/5 font-medium"
                />
              </div>
            )}

            {loglineError && <ErrorBanner message={loglineError} />}

            <div className="flex justify-end pt-2">
              <Button onClick={goToStep2} disabled={!logline.trim()}>
                Next: Structure
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Structure
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">2</span>
              Story Structure
            </CardTitle>
            <CardDescription>
              {targetDurationSec <= 60
                ? "A 3-beat structure (Hook → Escalation → Payoff) for your " + targetDurationSec + "s video."
                : "A 5-beat structure for your " + targetDurationSec + "s video."}
              {" "}Edit any beat description before continuing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <span className="font-medium">Logline: </span>
              {logline}
            </div>

            {beats.length === 0 ? (
              <Button
                type="button"
                onClick={handleGenerateStructure}
                disabled={generatingStructure}
              >
                {generatingStructure ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate Structure
              </Button>
            ) : (
              <>
                <div className="space-y-3">
                  {beats.map((beat, i) => (
                    <div key={beat.beatNumber} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {beat.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ~{beat.estimatedDurationSec}s
                        </span>
                      </div>
                      <Textarea
                        value={beat.description}
                        onChange={(e) => updateBeat(i, "description", e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateStructure}
                  disabled={generatingStructure}
                >
                  {generatingStructure ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Regenerate
                </Button>
              </>
            )}

            {structureError && <ErrorBanner message={structureError} />}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={goToStep3} disabled={beats.length === 0}>
                Next: Write Script
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — Script Expansion
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">3</span>
              Script
            </CardTitle>
            <CardDescription>
              Claude will write a full screenplay from your logline and beats. Edit the result freely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Beat summary */}
            <div className="flex flex-wrap gap-2">
              {beats.map((b) => (
                <span key={b.beatNumber} className="rounded bg-muted px-2 py-0.5 text-xs">
                  {b.label}
                </span>
              ))}
            </div>

            {!scriptText && !streaming && (
              <Button onClick={handleExpandScript} disabled={streaming}>
                <Sparkles className="mr-2 h-4 w-4" />
                Write the Script
              </Button>
            )}

            {streaming && (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={stopStream}>
                  Stop
                </Button>
                <span className="text-xs text-muted-foreground animate-pulse">
                  Writing…
                </span>
              </div>
            )}

            {(scriptText || streaming) && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs">Script — edit freely</Label>
                  {scriptText && !streaming && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={handleExpandScript}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Rewrite
                    </Button>
                  )}
                </div>
                <Textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={20}
                  className="font-mono text-xs leading-relaxed resize-y"
                  readOnly={streaming}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {scriptText.length.toLocaleString()} characters
                </p>
              </div>
            )}

            {scriptError && <ErrorBanner message={scriptError} />}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={streaming}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={goToStep4} disabled={!scriptText.trim() || streaming}>
                Next: Review
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4 — Review
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">4</span>
              Review
            </CardTitle>
            <CardDescription>
              Check the stats, then run the script through the full analysis pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Words", value: wordCount.toLocaleString(), icon: FileText },
                { label: "Est. runtime", value: `${estimatedSec}s`, icon: BarChart2 },
                { label: "Target", value: `${targetDurationSec}s`, icon: BarChart2 },
                {
                  label: "Fit",
                  value: estimatedSec <= targetDurationSec ? "On target" : "Too long",
                  icon: estimatedSec <= targetDurationSec ? Check : AlertCircle,
                  color: estimatedSec <= targetDurationSec ? "text-green-600" : "text-amber-600",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-muted/30 p-3 text-center">
                  <stat.icon className={`mx-auto mb-1 h-5 w-5 ${stat.color ?? "text-muted-foreground"}`} />
                  <p className={`text-lg font-bold ${stat.color ?? ""}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {estimatedSec > targetDurationSec * 1.15 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your script is ~{Math.round(((estimatedSec - targetDurationSec) / targetDurationSec) * 100)}% longer than the target.
                Consider editing it down or go back and adjust the beats.
              </div>
            )}

            {/* Script preview */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">Final script</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setStep(3)}
                >
                  <Edit3 className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              </div>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={12}
                className="font-mono text-xs leading-relaxed resize-y"
              />
            </div>

            {analyzeError && <ErrorBanner message={analyzeError} />}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Analyze this Script
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
