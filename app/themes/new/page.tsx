"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Youtube, Instagram, Facebook, Upload,
  Info, X, CheckCircle2, AlertCircle, Loader2, Film, RefreshCw
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeData {
  suggestedThemeName?: string;
  description?: string;
  genre?: string;
  tone?: string;
  visualStyle?: string;
  audioStyle?: string;
  lightingStyle?: string;
  cameraMovement?: string;
  dominantShotTypes?: string[];
  pacing?: string;
  estimatedAvgShotSeconds?: number;
  characterAgeRange?: string;
  characterAppearance?: string;
  characterMood?: string;
  primaryEnvironment?: string;
  timeOfDay?: string[];
  environmentDescription?: string;
  musicGenre?: string;
  musicMood?: string;
  musicTempo?: string;
  audioNotes?: string;
  visualPromptModifier?: string;
  audioPromptModifier?: string;
  cinematographyNotes?: string;
  colorPalette?: string[];
  colorMood?: string;
  colorTemperature?: string;
  saturation?: string;
  contrast?: string;
  referenceFramePaths?: string[];
  sourceUrl?: string;
  sourcePlatform?: string;
  analysisRawJson?: string;
}

type Step = "input" | "analyzing" | "review";

// ─── Constants ────────────────────────────────────────────────────────────────

const DID_YOU_KNOW = [
  "The visual prompt modifier is automatically added to every shot generation prompt when you use this theme.",
  "Themes capture lighting, pacing, color, and camera style — not just genre.",
  "You can fine-tune any extracted value after analysis.",
  "Using a theme pre-fills your character creation form with matching aesthetics.",
  "Themes increment a usage counter each time they're applied to a new project.",
];

const GENRES = ["Thriller", "Drama", "Romance", "Horror", "Action", "Comedy", "Fantasy", "Sci-Fi", "Mystery", "Documentary", "Anime", "Other"];
const TONES = ["Dark", "Hopeful", "Tragic", "Intimate", "Epic", "Suspenseful", "Restrained", "Playful", "Tense"];
const VISUAL_STYLES = ["Live-Action Cinematic", "Stylized Realism", "Anime", "Painterly", "Noir", "Retro", "Futuristic", "Fantasy Epic", "Documentary-Real"];
const AUDIO_STYLES = ["Orchestral", "Ambient", "Minimal", "Romantic Piano", "Electronic", "Dark Suspense", "Silence-Heavy Dramatic", "Documentary-Natural"];
const CAMERA_MOVEMENTS = ["Static", "Handheld", "Smooth Gimbal", "Dynamic/Fast", "Mixed"];
const SHOT_TYPES = ["Wide", "Medium", "Close-Up", "Insert", "Extreme Close-Up"];
const PACINGS = ["Slow", "Medium", "Fast", "Mixed"];
const ENVIRONMENTS = ["Urban Exterior", "Urban Interior", "Rural/Nature", "Suburban", "Industrial", "Fantasy/Otherworldly", "Mixed"];
const TEMPOS = ["Slow", "Medium", "Upbeat", "Intense"];
const TIMES_OF_DAY = ["Day", "Night", "Golden Hour", "Blue Hour", "Dawn", "Interior - Controlled"];

// ─── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  return "";
}

// ─── Step 1: URL Input ────────────────────────────────────────────────────────

function URLInputStep({
  onAnalyze,
}: {
  onAnalyze: (url: string | null, file: File | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [file, setFile] = useState<File | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("theme_legal_dismissed") === "1";
    setNoticeDismissed(dismissed);
  }, []);

  function dismissNotice() {
    localStorage.setItem("theme_legal_dismissed", "1");
    setNoticeDismissed(true);
  }

  function handleUrlChange(val: string) {
    setUrl(val);
    setPlatform(detectPlatform(val));
  }

  function handleSubmit() {
    if (tab === "url" && url.trim()) {
      onAnalyze(url.trim(), null);
    } else if (tab === "upload" && file) {
      onAnalyze(null, file);
    }
  }

  const canSubmit =
    (tab === "url" && url.trim().length > 10 && platform !== "") ||
    (tab === "upload" && file !== null);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Legal notice */}
      {!noticeDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <div className="flex-1 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">For personal style reference only</p>
            <p className="mt-0.5">
              This tool downloads videos temporarily for AI style analysis. Downloaded
              videos are deleted immediately after analysis. Only use publicly available
              content.
            </p>
          </div>
          <button
            onClick={dismissNotice}
            className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Platform icons */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
            <Youtube className="h-6 w-6 text-red-600" />
          </div>
          <span className="text-xs text-muted-foreground">YouTube</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-950">
            <Instagram className="h-6 w-6 text-pink-600" />
          </div>
          <span className="text-xs text-muted-foreground">Instagram</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Facebook className="h-6 w-6 text-blue-600" />
          </div>
          <span className="text-xs text-muted-foreground">Facebook</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border p-1 gap-1">
        <button
          onClick={() => setTab("url")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Paste URL
        </button>
        <button
          onClick={() => setTab("upload")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Upload File
        </button>
      </div>

      {tab === "url" ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border bg-background px-4 py-3 pr-36 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
            />
            {platform && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle2 className="h-3 w-3" />
                  {platform.charAt(0).toUpperCase() + platform.slice(1)} detected
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            YouTube: youtube.com/watch?v=… · Instagram: instagram.com/reel/… · Facebook: facebook.com/watch?v=…
          </p>
        </div>
      ) : (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 hover:bg-accent transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium">Click to upload video</p>
              <p className="text-xs text-muted-foreground">MP4, MOV, AVI, WebM up to 500MB</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        Analyze This Video
      </button>
    </div>
  );
}

// ─── Step 2: Progress ─────────────────────────────────────────────────────────

function AnalyzingStep({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) {
  const tip = DID_YOU_KNOW[Math.floor(Date.now() / 15000) % DID_YOU_KNOW.length];

  return (
    <div className="mx-auto max-w-lg space-y-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Film className="h-8 w-8 animate-pulse text-primary" />
        </div>
        <h2 className="text-xl font-bold">Analyzing Video Style</h2>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {message}
          </span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Did you know */}
      <div className="rounded-xl border bg-muted/30 p-4 text-left">
        <p className="text-xs font-medium text-muted-foreground mb-1">Did you know?</p>
        <p className="text-sm text-muted-foreground italic">&ldquo;{tip}&rdquo;</p>
      </div>
    </div>
  );
}

// ─── Step 3: Review and save ──────────────────────────────────────────────────

function ReviewStep({
  themeData,
  onSaved,
}: {
  themeData: ThemeData;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: themeData.suggestedThemeName ?? "",
    description: themeData.description ?? "",
    genre: themeData.genre ?? "",
    tone: themeData.tone ?? "",
    visualStyle: themeData.visualStyle ?? "",
    audioStyle: themeData.audioStyle ?? "",
    lightingStyle: themeData.lightingStyle ?? "",
    cameraMovement: themeData.cameraMovement ?? "",
    dominantShotTypes: themeData.dominantShotTypes ?? [],
    pacing: themeData.pacing ?? "",
    avgShotDurationSeconds: themeData.estimatedAvgShotSeconds ?? 4,
    characterAgeRange: themeData.characterAgeRange ?? "",
    characterAppearance: themeData.characterAppearance ?? "",
    characterMood: themeData.characterMood ?? "",
    primaryEnvironment: themeData.primaryEnvironment ?? "",
    timeOfDay: themeData.timeOfDay ?? [],
    environmentDescription: themeData.environmentDescription ?? "",
    musicGenre: themeData.musicGenre ?? "",
    musicMood: themeData.musicMood ?? "",
    musicTempo: themeData.musicTempo ?? "",
    audioNotes: themeData.audioNotes ?? "",
    visualPromptModifier: themeData.visualPromptModifier ?? "",
    audioPromptModifier: themeData.audioPromptModifier ?? "",
    cinematographyNotes: themeData.cinematographyNotes ?? "",
    coverFrameIndex: themeData.referenceFramePaths
      ? Math.floor(themeData.referenceFramePaths.length / 2)
      : 0,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors: string[] = themeData.colorPalette ?? [];
  const frames: string[] = themeData.referenceFramePaths ?? [];

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleShotType(t: string) {
    set("dominantShotTypes",
      form.dominantShotTypes.includes(t)
        ? form.dominantShotTypes.filter((x) => x !== t)
        : [...form.dominantShotTypes, t].slice(0, 3)
    );
  }

  function toggleTimeOfDay(t: string) {
    set("timeOfDay",
      form.timeOfDay.includes(t)
        ? form.timeOfDay.filter((x) => x !== t)
        : [...form.timeOfDay, t]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sourceUrl: themeData.sourceUrl,
          sourcePlatform: themeData.sourcePlatform,
          referenceFramePaths: frames,
          colorPalette: colors,
          colorMood: themeData.colorMood,
          colorTemperature: themeData.colorTemperature,
          saturation: themeData.saturation,
          contrast: themeData.contrast,
          analysisRawJson: themeData.analysisRawJson,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  // Temporary frame URL helper — frames are stored as local paths during analysis session
  function frameSrcByIndex(idx: number): string {
    // After analysis, frames are in permanent storage accessed via API
    // We use a placeholder during review — real images load via the API route after save
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="169"><rect width="300" height="169" fill="#1a1a2e"/><text x="150" y="85" text-anchor="middle" fill="#666" font-size="12">Frame ${idx + 1}</text></svg>`)}`;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h2 className="text-xl font-bold">Review Extracted Theme</h2>
      <p className="text-sm text-muted-foreground">
        Edit any field before saving. All values were extracted by AI from the video.
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* LEFT: Visual reference */}
        <div className="space-y-6">
          {/* Reference frames */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Reference Frames</h3>
            <div className="grid grid-cols-3 gap-2">
              {frames.length > 0
                ? frames.slice(0, 6).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => set("coverFrameIndex", i)}
                      className={`relative aspect-video overflow-hidden rounded-lg border-2 transition-colors ${form.coverFrameIndex === i ? "border-primary" : "border-transparent"}`}
                    >
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <Film className="h-6 w-6 text-muted-foreground/40" />
                        <span className="ml-1 text-xs text-muted-foreground">Frame {i + 1}</span>
                      </div>
                      {form.coverFrameIndex === i && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </button>
                  ))
                : Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                      <Film className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  ))}
            </div>
            <p className="text-xs text-muted-foreground">Click a frame to set it as the theme card cover</p>
          </div>

          {/* Color palette */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Color Palette</h3>
            <div className="flex gap-2 flex-wrap">
              {colors.length > 0
                ? colors.map((c, i) => (
                    <div key={i} className="text-center">
                      <div
                        className="h-10 w-10 rounded-lg border shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground font-mono">{c}</p>
                    </div>
                  ))
                : <p className="text-sm text-muted-foreground">No colors extracted</p>}
            </div>
            {themeData.colorTemperature && (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{themeData.colorTemperature} temperature</span>
                {themeData.saturation && <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{themeData.saturation}</span>}
                {themeData.contrast && <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{themeData.contrast} contrast</span>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Settings */}
        <div className="space-y-6">
          {/* Identity */}
          <Section title="Theme Identity">
            <Field label="Theme Name">
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                className="input-base" placeholder="My Theme" />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                rows={3} className="input-base resize-none" />
            </Field>
          </Section>

          {/* Core style */}
          <Section title="Core Style">
            <Field label="Genre">
              <DetectedSelect value={form.genre} onChange={(v) => set("genre", v)} options={GENRES} />
            </Field>
            <Field label="Tone">
              <DetectedSelect value={form.tone} onChange={(v) => set("tone", v)} options={TONES} />
            </Field>
            <Field label="Visual Style">
              <DetectedSelect value={form.visualStyle} onChange={(v) => set("visualStyle", v)} options={VISUAL_STYLES} />
            </Field>
            <Field label="Audio Style">
              <DetectedSelect value={form.audioStyle} onChange={(v) => set("audioStyle", v)} options={AUDIO_STYLES} />
            </Field>
          </Section>

          {/* Cinematography */}
          <Section title="Cinematography">
            <Field label="Lighting Style">
              <input type="text" value={form.lightingStyle} onChange={(e) => set("lightingStyle", e.target.value)} className="input-base" />
            </Field>
            <Field label="Camera Movement">
              <DetectedSelect value={form.cameraMovement} onChange={(v) => set("cameraMovement", v)} options={CAMERA_MOVEMENTS} />
            </Field>
            <Field label="Pacing">
              <DetectedSelect value={form.pacing} onChange={(v) => set("pacing", v)} options={PACINGS} />
            </Field>
            <Field label="Shot Types (up to 3)">
              <div className="flex flex-wrap gap-1.5">
                {SHOT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleShotType(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form.dominantShotTypes.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cinematography Notes">
              <textarea value={form.cinematographyNotes} onChange={(e) => set("cinematographyNotes", e.target.value)}
                rows={3} className="input-base resize-none" />
            </Field>
          </Section>

          {/* Character */}
          <Section title="Character Style">
            <Field label="Age Range">
              <input type="text" value={form.characterAgeRange} onChange={(e) => set("characterAgeRange", e.target.value)} className="input-base" />
            </Field>
            <Field label="Appearance Style">
              <textarea value={form.characterAppearance} onChange={(e) => set("characterAppearance", e.target.value)}
                rows={2} className="input-base resize-none" />
            </Field>
            <Field label="Character Mood">
              <input type="text" value={form.characterMood} onChange={(e) => set("characterMood", e.target.value)} className="input-base" />
            </Field>
          </Section>

          {/* Environment */}
          <Section title="Environment">
            <Field label="Primary Environment">
              <DetectedSelect value={form.primaryEnvironment} onChange={(v) => set("primaryEnvironment", v)} options={ENVIRONMENTS} />
            </Field>
            <Field label="Time of Day">
              <div className="flex flex-wrap gap-1.5">
                {TIMES_OF_DAY.map((t) => (
                  <button key={t} type="button" onClick={() => toggleTimeOfDay(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form.timeOfDay.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Environment Description">
              <textarea value={form.environmentDescription} onChange={(e) => set("environmentDescription", e.target.value)}
                rows={2} className="input-base resize-none" />
            </Field>
          </Section>

          {/* Audio */}
          <Section title="Audio Profile">
            <Field label="Music Genre">
              <input type="text" value={form.musicGenre} onChange={(e) => set("musicGenre", e.target.value)} className="input-base" />
            </Field>
            <Field label="Music Mood">
              <input type="text" value={form.musicMood} onChange={(e) => set("musicMood", e.target.value)} className="input-base" />
            </Field>
            <Field label="Music Tempo">
              <DetectedSelect value={form.musicTempo} onChange={(v) => set("musicTempo", v)} options={TEMPOS} />
            </Field>
            <Field label="Audio Notes">
              <textarea value={form.audioNotes} onChange={(e) => set("audioNotes", e.target.value)}
                rows={2} className="input-base resize-none" />
            </Field>
          </Section>

          {/* Prompt modifiers */}
          <Section title="Generation Prompt Modifiers">
            <Field
              label="Visual Prompt Modifier"
              hint="Added to every video/image generation prompt when using this theme"
            >
              <textarea value={form.visualPromptModifier} onChange={(e) => set("visualPromptModifier", e.target.value)}
                rows={4} className="input-base resize-none font-mono text-xs" />
            </Field>
            <Field
              label="Audio Prompt Modifier"
              hint="Added to every music generation prompt"
            >
              <textarea value={form.audioPromptModifier} onChange={(e) => set("audioPromptModifier", e.target.value)}
                rows={2} className="input-base resize-none font-mono text-xs" />
            </Field>
          </Section>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !form.name.trim()}
        className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving Theme…" : "Save Theme"}
      </button>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function DetectedSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base w-full appearance-none"
      >
        <option value="">— Select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {value && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300 pointer-events-none">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Detected
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ThemeNewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("Starting…");
  const [themeData, setThemeData] = useState<ThemeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ytdlpMissing, setYtdlpMissing] = useState(false);

  async function handleAnalyze(url: string | null, file: File | null) {
    setStep("analyzing");
    setProgress(5);
    setProgressMessage("Connecting…");
    setError(null);
    setYtdlpMissing(false);

    try {
      let body: BodyInit;
      let headers: HeadersInit = {};

      if (url) {
        body = JSON.stringify({ url });
        headers = { "Content-Type": "application/json" };
      } else if (file) {
        const form = new FormData();
        form.append("file", file);
        body = form;
      } else {
        throw new Error("Nothing to analyze");
      }

      const res = await fetch("/api/themes/analyze", { method: "POST", body, headers });

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (.+)/m);
          const dataMatch = part.match(/^data: (.+)/m);
          if (!dataMatch) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          const event = eventMatch?.[1] ?? "message";

          if (event === "status") {
            setProgress((parsed.progress as number) ?? progress);
            setProgressMessage((parsed.message as string) ?? "");
          } else if (event === "complete") {
            setThemeData(parsed.themeData as ThemeData);
            setStep("review");
          } else if (event === "error") {
            if (parsed.ytdlpMissing) setYtdlpMissing(true);
            setError((parsed.message as string) ?? "Analysis failed");
            setStep("input");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStep("input");
    }
  }

  function handleSaved(id: string) {
    router.push(`/themes/${id}`);
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/themes"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Analyze a Video Style</h1>
            <p className="text-sm text-muted-foreground">
              Paste a URL or upload a video to extract its visual theme
            </p>
          </div>
        </div>

        {/* yt-dlp missing banner */}
        {ytdlpMissing && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium text-amber-800 dark:text-amber-200">yt-dlp is not installed</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Install it to download videos for analysis, or use the file upload tab instead.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-xs text-amber-800 dark:text-amber-200 sm:grid-cols-2">
              <code className="rounded bg-amber-100 px-2 py-1 dark:bg-amber-900">macOS: brew install yt-dlp</code>
              <code className="rounded bg-amber-100 px-2 py-1 dark:bg-amber-900">Windows: winget install yt-dlp</code>
            </div>
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-amber-700 underline dark:text-amber-300"
            >
              Manual install instructions →
            </a>
          </div>
        )}

        {/* Error */}
        {error && step === "input" && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        )}

        {step === "input" && <URLInputStep onAnalyze={handleAnalyze} />}
        {step === "analyzing" && <AnalyzingStep progress={progress} message={progressMessage} />}
        {step === "review" && themeData && (
          <ReviewStep themeData={themeData} onSaved={handleSaved} />
        )}
      </div>

      {/* Global CSS for form inputs */}
      <style jsx global>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: box-shadow 0.1s;
        }
        .input-base:focus {
          box-shadow: 0 0 0 2px hsl(var(--primary));
        }
      `}</style>
    </div>
  );
}
