"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  MoreVertical,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  Clock,
  FolderOpen,
  Youtube,
  AlertTriangle,
  Loader2,
  ArchiveRestore,
  BookTemplate,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardProject {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  _count: { scenes: number; assets: number; jobs: number; posts: number };
  exports: { id: string; platform: string; createdAt: string }[];
  theme?: { id: string; name: string; colorPalette: string | null } | null;
}

export interface QuickStartTemplate {
  id: string;
  name: string;
  genre: string;
  tone: string;
  targetPlatform: string;
  targetLength: string;
}

interface Props {
  initialProjects: DashboardProject[];
  thumbnailUrls: Record<string, string>; // projectId → signed URL
  quickStartTemplates?: QuickStartTemplate[];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  DRAFT: { label: "Draft", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-700" },
  SCRIPT_ANALYZING: { label: "Analyzing", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-700" },
  PLANNING: { label: "Planning", dot: "bg-indigo-400", badge: "bg-indigo-100 text-indigo-700" },
  GENERATING: { label: "Generating", dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700" },
  ASSEMBLING: { label: "Assembling", dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-700" },
  COMPLETE: { label: "Complete", dot: "bg-green-500", badge: "bg-green-100 text-green-700" },
  PUBLISHED: { label: "Published", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  ARCHIVED: { label: "Archived", dot: "bg-gray-300", badge: "bg-gray-100 text-gray-500" },
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube_shorts: "YT Shorts",
  YOUTUBE_SHORTS: "YT Shorts",
  YOUTUBE_STANDARD: "YouTube",
  INSTAGRAM_REELS: "Instagram",
  TIKTOK: "TikTok",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function completedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPlatformLabel(project: DashboardProject): string {
  if (project.platform) return PLATFORM_LABELS[project.platform] ?? project.platform;
  const exp = project.exports[0];
  if (exp) return PLATFORM_LABELS[exp.platform] ?? exp.platform;
  return "—";
}

function getThemeColor(project: DashboardProject): string | null {
  const raw = project.theme?.colorPalette;
  if (!raw) return null;
  try {
    const colors = JSON.parse(raw);
    return Array.isArray(colors) && typeof colors[0] === "string" ? colors[0] : null;
  } catch {
    return null;
  }
}

// ─── Thumbnail placeholder ────────────────────────────────────────────────────

function Thumbnail({
  project,
  url,
  className = "",
}: {
  project: DashboardProject;
  url?: string;
  className?: string;
}) {
  const initials = project.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={project.name}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-muted text-muted-foreground font-bold text-lg ${className}`}
    >
      {initials || <FolderOpen className="h-6 w-6" />}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Save as Template modal ───────────────────────────────────────────────────

function SaveAsTemplateModal({
  project,
  onSaved,
  onCancel,
}: {
  project: DashboardProject;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Template name is required."); return; }
    if (!description.trim()) { setError("Please add a description."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          genre: "drama",          // defaults — user can edit in /templates/[id]/edit
          tone: "restrained",
          visualStyle: "live-action-cinematic",
          audioStyle: "sparse-piano",
          targetPlatform: project.platform ?? "youtube-shorts",
          targetLength: "medium",
          sourceProjectId: project.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const INCLUDED = [
    { label: "Genre and tone settings", saved: true },
    { label: "Visual style settings", saved: true },
    { label: "Audio style settings", saved: true },
    { label: "Target platform", saved: true },
    { label: "Target length", saved: true },
    { label: "Character configuration (voice IDs, descriptions)", saved: true },
    { label: "Music cue preferences", saved: true },
    { label: "Generated assets", saved: false },
    { label: "Script (templates are style, not story)", saved: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold">Save as Template</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capture the style settings from <span className="font-semibold text-foreground">{project.name}</span>
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Template Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template best for? What genre / mood does it suit?"
              rows={3}
            />
          </div>

          {/* What gets saved */}
          <div>
            <p className="mb-2 text-sm font-medium">What gets saved</p>
            <ul className="space-y-1.5">
              {INCLUDED.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.saved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className={item.saved ? "text-foreground" : "text-muted-foreground line-through"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><BookTemplate className="h-4 w-4" /> Save template</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

function ProjectMenu({
  project,
  onDuplicate,
  onArchive,
  onDelete,
  onSaveAsTemplate,
}: {
  project: DashboardProject;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isArchived = project.status === "ARCHIVED";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 rounded-md border bg-card shadow-lg py-1">
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </Link>
          <button
            onClick={() => { setOpen(false); onDuplicate(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            onClick={() => { setOpen(false); onSaveAsTemplate(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
          >
            <BookTemplate className="h-3.5 w-3.5" /> Save as Template
          </button>
          <button
            onClick={() => { setOpen(false); onArchive(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
          >
            {isArchived ? (
              <><ArchiveRestore className="h-3.5 w-3.5" /> Unarchive</>
            ) : (
              <><Archive className="h-3.5 w-3.5" /> Archive</>
            )}
          </button>
          <div className="my-1 border-t" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  project,
  onConfirm,
  onCancel,
}: {
  project: DashboardProject;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed === project.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold">Delete project</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">{project.name}</span>{" "}
              and all associated files from storage. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium">
            Type the project name to confirm:
          </label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={project.name}
            className="font-mono"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches}
          >
            Delete forever
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function ProjectDashboard({ initialProjects, thumbnailUrls, quickStartTemplates = [] }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"updatedAt" | "createdAt" | "name" | "status">("updatedAt");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);
  const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState<DashboardProject | null>(null);
  const [templateSavedNotice, setTemplateSavedNotice] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      if (!showArchived && p.status === "ARCHIVED") return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (platformFilter !== "ALL") {
        const pl = getPlatformLabel(p).toLowerCase();
        if (!pl.includes(platformFilter.toLowerCase())) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "createdAt")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return list;
  }, [projects, search, statusFilter, platformFilter, sortBy, showArchived]);

  const recentProjects = useMemo(
    () => projects.filter((p) => p.status !== "ARCHIVED").slice(0, 5),
    [projects]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleDuplicate(project: DashboardProject) {
    setPendingAction(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        router.push(`/projects/${json.data.id}`);
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function handleArchive(project: DashboardProject) {
    const archived = project.status !== "ARCHIVED";
    setPendingAction(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? { ...p, status: archived ? "ARCHIVED" : (p.completedAt ? "COMPLETE" : "DRAFT") }
              : p
          )
        );
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(project: DashboardProject) {
    setPendingAction(project.id);
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
      }
    } finally {
      setPendingAction(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10">
      {/* ── Quick-start from template ── */}
      {quickStartTemplates.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Start from Template
          </h2>
          <div className="flex flex-wrap gap-2">
            {quickStartTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/projects/new?templateId=${t.id}`}
                className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t.name}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
            <Link
              href="/templates"
              className="flex items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              View all templates →
            </Link>
          </div>
        </section>
      )}

      {/* ── Recent projects (horizontal scroll row) ── */}
      {recentProjects.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recent
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group w-52 shrink-0 rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <Thumbnail
                    project={p}
                    url={thumbnailUrls[p.id]}
                    className="h-full w-full"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold line-clamp-1">{p.name}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-muted-foreground">
                      {p.status === "COMPLETE" && p.completedAt
                        ? `Done ${completedDate(p.completedAt)}`
                        : relativeTime(p.updatedAt)}
                    </span>
                  </div>
                  {getPlatformLabel(p) !== "—" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getPlatformLabel(p)}
                    </p>
                  )}
                  {p.theme && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Theme: {p.theme.name}
                    </p>
                  )}
                </div>
                {p.theme && (
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: getThemeColor(p) ?? "hsl(var(--primary))" }}
                  />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── All projects section ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          All Projects
        </h2>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="ALL">All platforms</option>
            <option value="YouTube">YouTube</option>
            <option value="TikTok">TikTok</option>
            <option value="Instagram">Instagram</option>
          </select>

          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="updatedAt">Last edited</option>
            <option value="createdAt">Created</option>
            <option value="name">Title</option>
            <option value="status">Status</option>
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {/* Project grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No projects found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || statusFilter !== "ALL" || platformFilter !== "ALL"
                ? "Try adjusting your filters."
                : 'Click "New Video" to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const isPending = pendingAction === p.id;
              return (
                <div
                  key={p.id}
                  className={`group relative rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${
                    p.status === "ARCHIVED" ? "opacity-60" : ""
                  }`}
                >
                  {p.theme && (
                    <div
                      className="absolute inset-x-0 bottom-0 z-10 h-1"
                      style={{ backgroundColor: getThemeColor(p) ?? "hsl(var(--primary))" }}
                    />
                  )}
                  {/* Thumbnail */}
                  <Link href={`/projects/${p.id}`} className="block">
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      {isPending ? (
                        <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <Thumbnail
                          project={p}
                          url={thumbnailUrls[p.id]}
                          className="h-full w-full"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold line-clamp-1 flex-1">{p.name}</p>
                        <StatusBadge status={p.status} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {p.theme && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {p.theme.name}
                          </span>
                        )}
                        {getPlatformLabel(p) !== "—" && (
                          <span className="flex items-center gap-1">
                            <Youtube className="h-3 w-3" />
                            {getPlatformLabel(p)}
                          </span>
                        )}
                        <span>{p._count.scenes} scene{p._count.scenes !== 1 ? "s" : ""}</span>
                        {p._count.posts > 0 && (
                          <span className="text-emerald-600">
                            {p._count.posts} published
                          </span>
                        )}
                        <span className="flex items-center gap-1 ml-auto">
                          <Clock className="h-3 w-3" />
                          {p.status === "COMPLETE" && p.completedAt
                            ? `Done ${completedDate(p.completedAt)}`
                            : relativeTime(p.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Three-dot menu */}
                  <div className="absolute top-2 right-2">
                    <ProjectMenu
                      project={p}
                      onDuplicate={() => handleDuplicate(p)}
                      onArchive={() => handleArchive(p)}
                      onDelete={() => setDeleteTarget(p)}
                      onSaveAsTemplate={() => setSaveAsTemplateTarget(p)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Save as Template modal */}
      {saveAsTemplateTarget && (
        <SaveAsTemplateModal
          project={saveAsTemplateTarget}
          onSaved={() => {
            setSaveAsTemplateTarget(null);
            setTemplateSavedNotice(true);
            setTimeout(() => setTemplateSavedNotice(false), 4000);
          }}
          onCancel={() => setSaveAsTemplateTarget(null)}
        />
      )}

      {/* Template-saved notice */}
      {templateSavedNotice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-xl">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm font-medium">
            Template saved.{" "}
            <Link href="/templates" className="text-primary underline underline-offset-2">
              View in Template Library →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
