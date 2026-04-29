/**
 * /templates
 *
 * Template library page. Server component: fetches all templates and passes
 * them to the <TemplateGrid> client component.
 *
 * The "Save current project as template" button in the top bar is intentionally
 * rendered as a plain link to the /projects page so users can pick a project
 * from there. The actual Save-as-Template modal lives on the dashboard.
 */

import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import TemplateGrid, { type TemplateRecord } from "./_components/template-grid";

async function getTemplates(): Promise<TemplateRecord[]> {
  const templates = await db.template.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    genre: t.genre,
    tone: t.tone,
    visualStyle: t.visualStyle,
    audioStyle: t.audioStyle,
    targetPlatform: t.targetPlatform,
    targetLength: t.targetLength,
    isBuiltIn: t.isBuiltIn,
    usageCount: t.usageCount,
    sourceProjectId: t.sourceProjectId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
            <p className="text-sm text-muted-foreground">
              Reusable style presets — genre, tone, visual style, audio, and more.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <Plus className="mr-2 h-4 w-4" />
            Save project as template
          </Link>
        </Button>
      </div>

      <TemplateGrid initialTemplates={templates} />
    </div>
  );
}
