"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FolderOpen, Image, Plus, Settings, Video, Captions, ImageIcon } from "lucide-react";

const navItems = [
  {
    label: "Projects",
    href: "/",
    icon: FolderOpen,
  },
  {
    label: "Assets",
    href: "/assets",
    icon: Image,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

/** Extract project ID from a /projects/[id]/... pathname */
function getProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

export function Sidebar() {
  const pathname = usePathname();
  const projectId = getProjectId(pathname);

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Video className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">ClipPilot</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
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
              {item.label}
            </Link>
          );
        })}

        {/* Project sub-nav — only shown when inside a project */}
        {projectId && (
          <div className="mt-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              This Project
            </p>
            <Link
              href={`/projects/${projectId}/captions`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `/projects/${projectId}/captions`
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Captions className="h-4 w-4" />
              Captions
            </Link>
            <Link
              href={`/projects/${projectId}/thumbnails`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `/projects/${projectId}/thumbnails`
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Thumbnails
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">ClipPilot v0.1.0</p>
      </div>
    </aside>
  );
}
