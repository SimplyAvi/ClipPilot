/**
 * /themes/[id] — Theme detail page
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, ArrowRight, Film } from "lucide-react";
import { db } from "@/lib/db";
import { ThemeDetailClient } from "./_components/theme-detail-client";

function parseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export default async function ThemeDetailPage({ params }: { params: { id: string } }) {
  const theme = await db.theme.findUnique({
    where: { id: params.id },
    include: {
      projectsUsingTheme: {
        select: { id: true, name: true, status: true, platform: true, thumbnailPath: true },
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { projectsUsingTheme: true } },
    },
  });

  if (!theme) notFound();

  const framePaths: string[] = parseJson(theme.referenceFramePaths, []);
  const colorPalette: string[] = parseJson(theme.colorPalette, []);
  const dominantShotTypes: string[] = parseJson(theme.dominantShotTypes, []);
  const timeOfDay: string[] = parseJson(theme.timeOfDay, []);

  const serialized = {
    ...theme,
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
    referenceFramePaths: framePaths,
    colorPalette,
    dominantShotTypes,
    timeOfDay,
    projectsUsingTheme: theme.projectsUsingTheme.map((p) => ({
      ...p,
    })),
  };

  return <ThemeDetailClient theme={serialized} />;
}
