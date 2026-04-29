/**
 * /themes — Theme library page
 */

import Link from "next/link";
import { Plus, Palette } from "lucide-react";
import { db } from "@/lib/db";
import { ThemeGrid, type ThemeRecord } from "./_components/theme-grid";

async function getThemes(): Promise<ThemeRecord[]> {
  const themes = await db.theme.findMany({
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { projectsUsingTheme: true } } },
  });

  return themes.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: undefined as never,
  })) as ThemeRecord[];
}

export default async function ThemesPage() {
  let themes: ThemeRecord[] = [];
  try {
    themes = await getThemes();
  } catch {
    // DB may not be ready during build
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Themes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visual style profiles extracted from real videos
          </p>
        </div>
        <Link
          href="/themes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Theme from Video
        </Link>
      </div>

      {/* Theme count */}
      {themes.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {themes.length} theme{themes.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Grid */}
      <ThemeGrid initialThemes={themes} />
    </div>
  );
}
