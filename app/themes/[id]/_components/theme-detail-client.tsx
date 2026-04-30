"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Trash2, ArrowRight, Film, ExternalLink,
  Plus
} from "lucide-react";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { GenerateFromThemeModal } from "@/app/characters/_components/generate-from-theme-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  thumbnailPath: string | null;
}

interface GeneratedCharacter {
  id: string;
  name: string;
  role: string | null;
  portraitPath: string | null;
}

export interface ThemeDetailData {
  id: string;
  name: string;
  description: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  referenceFramePaths: string[];
  coverFrameIndex: number;
  colorPalette: string[];
  colorMood: string | null;
  colorTemperature: string | null;
  saturation: string | null;
  contrast: string | null;
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
  usageCount: number;
  createdAt: string;
  projectsUsingTheme: Project[];
  generatedCharacters: GeneratedCharacter[];
  _count: { projectsUsingTheme: number };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  themeId,
  themeName,
  onClose,
}: {
  themeId: string;
  themeName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/themes/${themeId}`, { method: "DELETE" });
    router.push("/themes");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold">Delete this theme?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          &ldquo;{themeName}&rdquo; will be permanently deleted, including all reference
          frames and analysis data.
        </p>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThemeDetailClient({ theme }: { theme: ThemeDetailData }) {
  const [showDelete, setShowDelete] = useState(false);

  const frameCount = theme.referenceFramePaths.length;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      {showDelete && (
        <DeleteModal
          themeId={theme.id}
          themeName={theme.name}
          onClose={() => setShowDelete(false)}
        />
      )}

      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/themes"
          className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Themes</span>
      </div>

      {/* Hero: frame strip + colors */}
      <div className="space-y-4">
        {frameCount > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {theme.referenceFramePaths.map((_, i) => (
              <div
                key={i}
                className={`relative flex-shrink-0 overflow-hidden rounded-xl ${i === theme.coverFrameIndex ? "ring-2 ring-primary" : ""}`}
                style={{ width: 220, height: 124 }}
              >
                <img
                  src={`/api/themes/${theme.id}/frame/${i}`}
                  alt={`Frame ${i + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    (e.currentTarget.parentElement as HTMLElement).style.background = "hsl(var(--muted))";
                  }}
                />
                {i === theme.coverFrameIndex && (
                  <div className="absolute bottom-1 right-1">
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Cover</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-xl bg-muted">
            <Film className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Color swatches */}
        {theme.colorPalette.length > 0 && (
          <div className="flex items-center gap-2">
            {theme.colorPalette.map((c, i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-lg border shadow-sm flex-shrink-0"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            {theme.colorMood && (
              <span className="ml-2 text-sm text-muted-foreground">
                {theme.colorMood} · {theme.colorTemperature} · {theme.saturation} · {theme.contrast} contrast
              </span>
            )}
          </div>
        )}
      </div>

      {/* Name, description, actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{theme.name}</h1>
          {theme.description && (
            <p className="mt-2 text-muted-foreground">{theme.description}</p>
          )}
          {theme.sourceUrl && (
            <a
              href={theme.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              Source video
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {theme._count.projectsUsingTheme} project{theme._count.projectsUsingTheme !== 1 ? "s" : ""} using this theme
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/themes/${theme.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <Link
            href={`/projects/new?themeId=${theme.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Use This Theme
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Style profile grid */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Style Profile</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Genre" value={theme.genre} />
          <StatCard label="Tone" value={theme.tone} />
          <StatCard label="Visual Style" value={theme.visualStyle} />
          <StatCard label="Audio Style" value={theme.audioStyle} />
          <StatCard label="Lighting" value={theme.lightingStyle} />
          <StatCard label="Camera" value={theme.cameraMovement} />
          <StatCard label="Pacing" value={theme.pacing} />
          <StatCard label="Avg Shot Duration" value={theme.avgShotDurationSeconds ? `${theme.avgShotDurationSeconds}s` : null} />
          <StatCard label="Environment" value={theme.primaryEnvironment} />
          <StatCard label="Time of Day" value={theme.timeOfDay.join(", ") || null} />
          <StatCard label="Character Age" value={theme.characterAgeRange} />
          <StatCard label="Character Mood" value={theme.characterMood} />
          <StatCard label="Music Genre" value={theme.musicGenre} />
          <StatCard label="Music Tempo" value={theme.musicTempo} />
          {theme.dominantShotTypes.length > 0 && (
            <div className="rounded-xl border bg-card p-4 shadow-sm col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Shot Types</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {theme.dominantShotTypes.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prompt modifiers */}
      <div className="space-y-4">
        {theme.visualPromptModifier && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Visual Prompt Modifier</p>
            <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{theme.visualPromptModifier}</p>
          </div>
        )}
        {theme.audioPromptModifier && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Audio Prompt Modifier</p>
            <p className="text-sm font-mono text-muted-foreground">{theme.audioPromptModifier}</p>
          </div>
        )}
        {theme.cinematographyNotes && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cinematography Notes</p>
            <p className="text-sm text-muted-foreground">{theme.cinematographyNotes}</p>
          </div>
        )}
        {theme.environmentDescription && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Environment</p>
            <p className="text-sm text-muted-foreground">{theme.environmentDescription}</p>
          </div>
        )}
        {theme.characterAppearance && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Character Aesthetics</p>
            <p className="text-sm text-muted-foreground">{theme.characterAppearance}</p>
          </div>
        )}
      </div>

      {/* Projects using this theme */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Characters Generated from This Theme</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {theme.generatedCharacters.map((character) => (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              className="w-40 flex-shrink-0 overflow-hidden rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <PortraitFrame src={character.portraitPath} alt={character.name} size="sm" className="rounded-b-none border-0" />
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{character.name}</p>
                <p className="truncate text-xs text-muted-foreground">{character.role ?? "Character"}</p>
              </div>
            </Link>
          ))}
          <div className="flex h-[250px] w-40 flex-shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center">
            <GenerateFromThemeModal
              themes={[{
                id: theme.id,
                name: theme.name,
                description: theme.description,
                genre: theme.genre,
                tone: theme.tone,
                colorPalette: JSON.stringify(theme.colorPalette),
                colorMood: theme.colorMood,
                coverFrameIndex: theme.coverFrameIndex,
              }]}
              initialThemeId={theme.id}
              triggerClassName="h-full w-full bg-transparent text-foreground hover:bg-accent"
            />
          </div>
        </div>
      </div>

      {/* Projects using this theme */}
      {theme.projectsUsingTheme.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Projects Using This Theme</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {theme.projectsUsingTheme.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm hover:bg-accent transition-colors"
              >
                <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
                  {p.thumbnailPath ? (
                    <img src={p.thumbnailPath} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs font-bold">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{p.status.toLowerCase().replace("_", " ")}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
