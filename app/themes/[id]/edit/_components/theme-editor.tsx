"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Options (match vision-analyzer) ─────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeEditorData {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  tone: string | null;
  visualStyle: string | null;
  audioStyle: string | null;
  lightingStyle: string | null;
  cameraMovement: string | null;
  dominantShotTypes: string[];
  pacing: string | null;
  avgShotDurationSeconds: number | null;
  characterAgeRange: string | null;
  characterAppearance: string | null;
  characterMood: string | null;
  primaryEnvironment: string | null;
  timeOfDay: string[];
  environmentDescription: string | null;
  musicGenre: string | null;
  musicMood: string | null;
  musicTempo: string | null;
  audioNotes: string | null;
  visualPromptModifier: string | null;
  audioPromptModifier: string | null;
  cinematographyNotes: string | null;
  coverFrameIndex: number;
  referenceFramePaths: string[];
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function ThemeEditor({ theme }: { theme: ThemeEditorData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: theme.name,
    description: theme.description ?? "",
    genre: theme.genre ?? "",
    tone: theme.tone ?? "",
    visualStyle: theme.visualStyle ?? "",
    audioStyle: theme.audioStyle ?? "",
    lightingStyle: theme.lightingStyle ?? "",
    cameraMovement: theme.cameraMovement ?? "",
    dominantShotTypes: theme.dominantShotTypes,
    pacing: theme.pacing ?? "",
    avgShotDurationSeconds: theme.avgShotDurationSeconds ?? 4,
    characterAgeRange: theme.characterAgeRange ?? "",
    characterAppearance: theme.characterAppearance ?? "",
    characterMood: theme.characterMood ?? "",
    primaryEnvironment: theme.primaryEnvironment ?? "",
    timeOfDay: theme.timeOfDay,
    environmentDescription: theme.environmentDescription ?? "",
    musicGenre: theme.musicGenre ?? "",
    musicMood: theme.musicMood ?? "",
    musicTempo: theme.musicTempo ?? "",
    audioNotes: theme.audioNotes ?? "",
    visualPromptModifier: theme.visualPromptModifier ?? "",
    audioPromptModifier: theme.audioPromptModifier ?? "",
    cinematographyNotes: theme.cinematographyNotes ?? "",
    coverFrameIndex: theme.coverFrameIndex,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
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
      const res = await fetch(`/api/themes/${theme.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/themes/${theme.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Edit Theme</h1>
          <p className="text-sm text-muted-foreground">{theme.name}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Cover frame picker */}
      {theme.referenceFramePaths.length > 0 && (
        <Section title="Cover Frame">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {theme.referenceFramePaths.map((_, i) => (
              <button
                key={i}
                onClick={() => set("coverFrameIndex", i)}
                className={`relative flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${form.coverFrameIndex === i ? "border-primary" : "border-transparent"}`}
                style={{ width: 140, height: 79 }}
              >
                <img
                  src={`/api/themes/${theme.id}/frame/${i}`}
                  alt={`Frame ${i + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                {form.coverFrameIndex === i && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Identity">
        <Field label="Name">
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      <Section title="Core Style">
        {[
          { label: "Genre", key: "genre", options: GENRES },
          { label: "Tone", key: "tone", options: TONES },
          { label: "Visual Style", key: "visualStyle", options: VISUAL_STYLES },
          { label: "Audio Style", key: "audioStyle", options: AUDIO_STYLES },
        ].map(({ label, key, options }) => (
          <Field key={key} label={label}>
            <select value={(form as Record<string, unknown>)[key] as string}
              onChange={(e) => set(key, e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="">— Select —</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        ))}
      </Section>

      <Section title="Cinematography">
        <Field label="Lighting Style">
          <input type="text" value={form.lightingStyle} onChange={(e) => set("lightingStyle", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Camera Movement">
          <select value={form.cameraMovement} onChange={(e) => set("cameraMovement", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">— Select —</option>
            {CAMERA_MOVEMENTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Pacing">
          <select value={form.pacing} onChange={(e) => set("pacing", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">— Select —</option>
            {PACINGS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Shot Types (up to 3)">
          <div className="flex flex-wrap gap-1.5">
            {SHOT_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => toggleShotType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${form.dominantShotTypes.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Cinematography Notes">
          <textarea value={form.cinematographyNotes} onChange={(e) => set("cinematographyNotes", e.target.value)}
            rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      <Section title="Character Style">
        <Field label="Age Range">
          <input type="text" value={form.characterAgeRange} onChange={(e) => set("characterAgeRange", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Appearance Style">
          <textarea value={form.characterAppearance} onChange={(e) => set("characterAppearance", e.target.value)}
            rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Character Mood">
          <input type="text" value={form.characterMood} onChange={(e) => set("characterMood", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      <Section title="Environment">
        <Field label="Primary Environment">
          <select value={form.primaryEnvironment} onChange={(e) => set("primaryEnvironment", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">— Select —</option>
            {ENVIRONMENTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
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
            rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      <Section title="Audio Profile">
        <Field label="Music Genre">
          <input type="text" value={form.musicGenre} onChange={(e) => set("musicGenre", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Music Mood">
          <input type="text" value={form.musicMood} onChange={(e) => set("musicMood", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Music Tempo">
          <select value={form.musicTempo} onChange={(e) => set("musicTempo", e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">— Select —</option>
            {TEMPOS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Audio Notes">
          <textarea value={form.audioNotes} onChange={(e) => set("audioNotes", e.target.value)}
            rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      <Section title="Generation Prompt Modifiers">
        <Field label="Visual Prompt Modifier" hint="Added to every shot generation prompt when using this theme">
          <textarea value={form.visualPromptModifier} onChange={(e) => set("visualPromptModifier", e.target.value)}
            rows={4} className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
        <Field label="Audio Prompt Modifier" hint="Added to every music generation prompt">
          <textarea value={form.audioPromptModifier} onChange={(e) => set("audioPromptModifier", e.target.value)}
            rows={2} className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs outline-none resize-none focus:ring-2 focus:ring-primary" />
        </Field>
      </Section>

      {/* Bottom save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
