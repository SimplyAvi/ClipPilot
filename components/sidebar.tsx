"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Image,
  Plus,
  Settings,
  Video,
  Captions,
  ImageIcon,
  Share2,
  History,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  BarChart2,
  UserRound,
  FolderOpen as FolderFiles,
} from "lucide-react";

// ─── Status dot colours (matches project-dashboard.tsx) ───────────────────────

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-gray-400",
  SCRIPT_ANALYZING: "bg-blue-400",
  PLANNING: "bg-indigo-400",
  GENERATING: "bg-yellow-400",
  ASSEMBLING: "bg-orange-400",
  IN_PROGRESS: "bg-blue-400",
  COMPLETE: "bg-green-500",
  PUBLISHED: "bg-emerald-500",
  ARCHIVED: "bg-gray-300",
};

interface RecentProject {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

const navItems = [
  { label: "Projects", href: "/", icon: FolderOpen },
  { label: "Characters", href: "/characters", icon: UserRound, count: true },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Assets", href: "/assets", icon: Image },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Extract project ID from a /projects/[id]/... pathname */
function getProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

// ─── Recent projects section ──────────────────────────────────────────────────

function RecentProjectsList() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [projects, setProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const all: RecentProject[] = (json.data ?? [])
          .filter((p: RecentProject) => p.status !== "ARCHIVED")
          .slice(0, 5)
          .map((p: RecentProject) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            updatedAt: p.updatedAt,
          }));
        setProjects(all);
      })
      .catch(() => {/* silently ignore */});
    return () => { cancelled = true; };
  }, [pathname]); // re-fetch when navigation changes

  if (projects.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Recent
      </button>

      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {projects.map((p) => {
            const dot = STATUS_DOT[p.status] ?? "bg-gray-400";
            const isActive = pathname.startsWith(`/projects/${p.id}`);
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="truncate">{p.name}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              View all projects →
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const projectId = getProjectId(pathname);
  const [characterCount, setCharacterCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/characters")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setCharacterCount((json.data ?? []).length);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Video className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">ClipPilot</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {/* Primary CTA */}
        <Link
          href="/projects/new"
          className="mb-2 flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Video
        </Link>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.count && characterCount !== null && (
                <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
                  {characterCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Recent projects collapsible list */}
        <RecentProjectsList />

        {/* Project sub-nav — only shown when inside a project */}
        {projectId && (
          <div className="mt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              This Project
            </p>
            {[
              { href: `/projects/${projectId}/captions`, label: "Captions", Icon: Captions },
              { href: `/projects/${projectId}/thumbnails`, label: "Thumbnails", Icon: ImageIcon },
              { href: `/projects/${projectId}/publish`, label: "Publish", Icon: Share2 },
              { href: `/projects/${projectId}/versions`, label: "Versions", Icon: History },
              { href: `/projects/${projectId}/files`, label: "Files", Icon: FolderFiles },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">ClipPilot v0.1.0</p>
      </div>
    </aside>
  );
}
