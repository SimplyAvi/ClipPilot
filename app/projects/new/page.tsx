"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertCircle,
  FileText,
  Lightbulb,
  Loader2,
  Upload,
  FileUp,
  ClipboardList,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

// ─── Option lists ─────────────────────────────────────────────────────────────

const GENRES = [
  { value: "thriller", label: "Thriller" },
  { value: "drama", label: "Drama" },
  { value: "romance", label: "Romance" },
  { value: "horror", label: "Horror" },
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "fantasy", label: "Fantasy" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "mystery", label: "Mystery" },
  { value: "documentary", label: "Documentary" },
  { value: "other", label: "Other" },
];

const TONES = [
  { value: "dark", label: "Dark" },
  { value: "hopeful", label: "Hopeful" },
  { value: "tragic", label: "Tragic" },
  { value: "intimate", label: "Intimate" },
  { value: "epic", label: "Epic" },
  { value: "suspenseful", label: "Suspenseful" },
  { value: "restrained", label: "Restrained" },
  { value: "playful", label: "Playful" },
  { value: "tense", label: "Tense" },
];

const PLATFORMS = [
  { value: "youtube-shorts", label: "YouTube Shorts (max 60s)" },
  { value: "instagram-reels", label: "Instagram Reels (max 90s)" },
  { value: "tiktok", label: "TikTok (max 60s)" },
  { value: "youtube-standard", label: "YouTube Standard (no limit)" },
];

const TARGET_LENGTHS = [
  { value: "ai-recommend", label: "Let AI Recommend", sub: "Claude picks the best fit" },
  { value: "short", label: "Short", sub: "~30 seconds" },
  { value: "medium", label: "Medium", sub: "~60 seconds" },
  { value: "long", label: "Long", sub: "~90 seconds" },
];

const LOADING_MESSAGES = [
  "Reading your script…",
  "Identifying scenes and characters…",
  "Planning the shot structure…",
  "Calculating runtime options…",
  "Finalising your production plan…",
];

// ─── Template banner ──────────────────────────────────────────────────────────

interface TemplateMeta { id: string; name: string }

function TemplateBanner({ template, onDismiss }: { template: TemplateMeta; onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>
        Using template: <span className="font-semibold">{template.name}</span>.{" "}
        All style settings are pre-configured.
      </span>
      <button onClick={onDismiss} className="ml-auto text-green-600 hover:text-green-800">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Inner form (uses useSearchParams — must be wrapped in Suspense) ───────────

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template state
  const [activeTemplate, setActiveTemplate] = useState<TemplateMeta | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Which starting option is selected
  const [mode, setMode] = useState<"none" | "script">("none");

  // Script input tab
  const [inputTab, setInputTab] = useState<"paste" | "upload">("paste");

  // Form fields
  const [projectName, setProjectName] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [targetLength, setTargetLength] = useState("ai-recommend");
  const [fileName, setFileName] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load template from query param on mount
  useEffect(() => {
    const templateId = searchParams.get("templateId");
    if (!templateId) return;

    setLoadingTemplate(true);
    fetch(`/api/templates/${templateId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const t = json.data;
        setActiveTemplate({ id: t.id, name: t.name });
        if (t.genre) setGenre(t.genre);
        if (t.tone) setTone(t.tone);
        if (t.targetPlatform) setPlatform(t.targetPlatform);
        if (t.targetLength) setTargetLength(t.targetLength);
        // Auto-select script mode so fields are visible
        setMode("script");
      })
      .catch(() => {/* silently ignore — user can still fill in manually */})
      .finally(() => setLoadingTemplate(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate loading messages every 3 seconds
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── File handling ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      setError("Only .txt and .pdf files are supported. Please upload one of those.");
      return;
    }

    setFileName(file.name);
    setError(null);

    if (ext === "txt") {
      const text = await file.text();
      setScriptText(text);
    } else {
      // PDF — send to extract-text endpoint
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/scripts/extract-text", { method: "POST", body: fd });
        const json = await res.json();
        if (json.error) {
          setError(
            "Could not read this PDF. Try copying and pasting the text directly instead."
          );
          setFileName(null);
        } else {
          setScriptText(json.data.text);
          setInputTab("paste"); // switch to paste tab so user can see the text
        }
      } catch {
        setError("Could not read this PDF. Try copying and pasting the text directly instead.");
        setFileName(null);
      } finally {
        setLoading(false);
      }
    }
  }

  // ── Form submission ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectName.trim()) { setError("Project name is required."); return; }
    if (!scriptText.trim() || scriptText.trim().length < 50) {
      setError("Script must be at least 50 characters. Please add more content.");
      return;
    }
    if (!genre) { setError("Please select a genre."); return; }
    if (!tone) { setError("Please select a tone."); return; }
    if (!platform) { setError("Please select a target platform."); return; }

    setLoading(true);
    setLoadingMsgIdx(0);

    try {
      const res = await fetch("/api/scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, scriptText, genre, tone, platform, targetLength }),
      });

      const json = await res.json();

      if (res.status === 503) {
        setError(
          "Anthropic API key not configured. Go to Settings → AI Providers to add your key."
        );
        return;
      }

      if (res.status === 429) {
        setError("Too many requests — please wait a moment and try again.");
        return;
      }

      if (!res.ok || json.error) {
        setError(json.error ?? "Analysis failed. Please try again.");
        return;
      }

      router.push(`/projects/${json.data.projectId}/analysis`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Loading screen ────────────────────────────────────────────────────────

  if (loading && mode === "script") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 py-32 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
          <Loader2 className="absolute h-10 w-10 animate-spin text-primary" style={{ animationDuration: "0.75s" }} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">{LOADING_MESSAGES[loadingMsgIdx]}</p>
          <p className="text-sm text-muted-foreground">
            This can take 10–30 seconds for longer scripts
          </p>
        </div>
        <div className="flex gap-1.5">
          {LOADING_MESSAGES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === loadingMsgIdx ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
        <p className="mt-1 text-muted-foreground">
          Start from an existing script or describe your idea.
        </p>
      </div>

      {/* Template banner */}
      {loadingTemplate && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading template settings…
        </div>
      )}
      {activeTemplate && !loadingTemplate && (
        <TemplateBanner
          template={activeTemplate}
          onDismiss={() => setActiveTemplate(null)}
        />
      )}

      {/* ── Starting option cards ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Card A: Start from a Script */}
        <button
          type="button"
          onClick={() => setMode("script")}
          className={`group flex flex-col gap-3 rounded-xl border-2 p-6 text-left transition-all ${
            mode === "script"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              mode === "script" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            }`}
          >
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Start from a Script</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Upload an existing screenplay, outline, or story
            </p>
          </div>
        </button>

        {/* Card B: Start from an Idea */}
        <button
          type="button"
          onClick={() => router.push("/projects/new/from-idea")}
          className="group flex flex-col gap-3 rounded-xl border-2 border-border p-6 text-left transition-all hover:border-primary/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Start from an Idea</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Describe your idea and let AI write the script
            </p>
          </div>
        </button>
      </div>

      {/* ── Script form — only shown when Card A is selected ── */}
      {mode === "script" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Project name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g. The Last Conversation"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </div>

          {/* Script input — tabbed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Script</CardTitle>
              <CardDescription>Paste your script text or upload a file.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Tab buttons */}
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setInputTab("paste")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    inputTab === "paste"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab("upload")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    inputTab === "upload"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Upload File
                </button>
              </div>

              {inputTab === "paste" && (
                <div className="flex flex-col gap-1.5">
                  <Textarea
                    placeholder={"INT. COFFEE SHOP - DAY\n\nMAYA sits across from JASON…"}
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    className="min-h-48 font-mono text-xs leading-relaxed"
                    rows={12}
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {scriptText.length.toLocaleString()} / 20,000 characters
                  </p>
                </div>
              )}

              {inputTab === "upload" && (
                <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {fileName ? (
                    <>
                      <FileText className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{fileName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scriptText.length.toLocaleString()} characters extracted
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace file
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Drop a file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Accepts .txt and .pdf
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose file
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Target Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target length — radio */}
          <div className="flex flex-col gap-2">
            <Label>Target Length</Label>
            <div className="grid gap-2 sm:grid-cols-4">
              {TARGET_LENGTHS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetLength(opt.value)}
                  className={`flex flex-col gap-0.5 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                    targetLength === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API key warning banner */}
          {error?.includes("API key") && (
            <div className="flex items-start gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}{" "}
                <a href="/settings" className="underline font-medium">
                  Go to Settings
                </a>
              </span>
            </div>
          )}

          {/* Generic error */}
          {error && !error.includes("API key") && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analysing…
              </>
            ) : (
              "Analyse Script"
            )}
          </Button>
        </form>
      )}

      {/* ── Settings nudge when no mode selected ── */}
      {mode === "none" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="h-3.5 w-3.5" />
          Make sure your Anthropic API key is configured in{" "}
          <a href="/settings" className="underline underline-offset-2">Settings → AI Providers</a>{" "}
          before analysing.
        </div>
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
// Wrap in Suspense so useSearchParams() inside NewProjectForm doesn't break
// static rendering.

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">Loading…</div>}>
      <NewProjectForm />
    </Suspense>
  );
}
