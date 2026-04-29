"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, Palette, Trash2, Pencil, ArrowRight, Clapperboard } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeRecord {
  id: string;
  name: string;
  description: string | null;
  sourcePlatform: string | null;
  colorPalette: string | null;       // JSON string
  colorMood: string | null;
  genre: string | null;
  tone: string | null;
  visualStyle: string | null;
  audioStyle: string | null;
  pacing: string | null;
  usageCount: number;
  coverFrameIndex: number;
  createdAt: string;
  _count: { projectsUsingTheme: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseColors(colorPaletteJson: string | null): string[] {
  if (!colorPaletteJson) return [];
  try {
    return JSON.parse(colorPaletteJson);
  } catch {
    return [];
  }
}

const PLATFORM_BADGE: Record<string, string> = {
  youtube: "bg-red-100 text-red-700",
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  upload: "bg-gray-100 text-gray-600",
};

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  theme,
  onClose,
  onDeleted,
}: {
  theme: ThemeRecord;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/themes/${theme.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold">Delete theme?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          &ldquo;{theme.name}&rdquo; will be permanently deleted. Reference frames
          and analysis data will be removed.
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  onDelete,
}: {
  theme: ThemeRecord;
  onDelete: (theme: ThemeRecord) => void;
}) {
  const colors = parseColors(theme.colorPalette);
  const coverSrc = `/api/themes/${theme.id}/frame/${theme.coverFrameIndex}`;

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Cover frame */}
      <div className="relative aspect-video bg-muted">
        <img
          src={coverSrc}
          alt={theme.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Platform badge */}
        {theme.sourcePlatform && theme.sourcePlatform !== "manual" && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PLATFORM_BADGE[theme.sourcePlatform] ?? "bg-gray-100 text-gray-600"}`}
          >
            {theme.sourcePlatform}
          </span>
        )}
        {/* Action buttons on hover */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/themes/${theme.id}/edit`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 text-muted-foreground shadow hover:text-foreground transition-colors"
            aria-label="Edit theme"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onDelete(theme)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 text-muted-foreground shadow hover:text-destructive transition-colors"
            aria-label="Delete theme"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Color palette dots */}
      {colors.length > 0 && (
        <div className="flex items-center gap-1 border-b px-4 py-2">
          {colors.slice(0, 6).map((color, i) => (
            <span
              key={i}
              className="h-4 w-4 rounded-full border border-black/10 shadow-sm flex-shrink-0"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm leading-tight">{theme.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {theme.genre && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {theme.genre}
              </span>
            )}
            {theme.tone && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {theme.tone}
              </span>
            )}
            {theme.pacing && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {theme.pacing} pacing
              </span>
            )}
          </div>
        </div>

        {theme.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {theme.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {theme._count.projectsUsingTheme > 0
              ? `Used in ${theme._count.projectsUsingTheme} project${theme._count.projectsUsingTheme !== 1 ? "s" : ""}`
              : "Not used yet"}
          </span>
          <div className="flex gap-1.5">
            <Link
              href={`/themes/${theme.id}`}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              View
            </Link>
            <Link
              href={`/projects/new?themeId=${theme.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Use
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Grid ────────────────────────────────────────────────────────────────

export function ThemeGrid({ initialThemes }: { initialThemes: ThemeRecord[] }) {
  const router = useRouter();
  const [themes, setThemes] = useState(initialThemes);
  const [deleteTarget, setDeleteTarget] = useState<ThemeRecord | null>(null);

  function handleDeleted() {
    if (!deleteTarget) return;
    setThemes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          theme={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {themes.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 py-20 text-center">
          <Clapperboard className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">No themes yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Find a video on YouTube, Instagram, or Facebook with a visual style
            you love and analyze it here.
          </p>
          <Link
            href="/themes/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Palette className="h-4 w-4" />
            Create Your First Theme
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onDelete={(t) => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}
    </>
  );
}
