/**
 * /templates/[id]/edit
 *
 * Editor for user-created templates. Built-in templates redirect back to /templates.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import TemplateEditor from "./_components/template-editor";

export default async function TemplateEditPage({
  params,
}: {
  params: { id: string };
}) {
  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) notFound();
  if (template.isBuiltIn) redirect("/templates");

  const serialized = {
    id: template.id,
    name: template.name,
    description: template.description,
    genre: template.genre,
    tone: template.tone,
    visualStyle: template.visualStyle,
    audioStyle: template.audioStyle,
    targetPlatform: template.targetPlatform,
    targetLength: template.targetLength,
    isBuiltIn: template.isBuiltIn,
    usageCount: template.usageCount,
    characterConfig: template.characterConfig,
    musicConfig: template.musicConfig,
    generationConfig: template.generationConfig,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Edit Template</h1>
          <p className="text-sm text-muted-foreground">{template.name}</p>
        </div>
      </div>

      <TemplateEditor template={serialized} />
    </div>
  );
}
