/**
 * /themes/[id]/edit — Edit a theme's extracted values
 */

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ThemeEditor } from "./_components/theme-editor";

function parseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export default async function ThemeEditPage({ params }: { params: { id: string } }) {
  const theme = await db.theme.findUnique({ where: { id: params.id } });
  if (!theme) notFound();

  const serialized = {
    ...theme,
    createdAt: theme.createdAt.toISOString(),
    updatedAt: theme.updatedAt.toISOString(),
    referenceFramePaths: parseJson<string[]>(theme.referenceFramePaths, []),
    colorPalette: parseJson<string[]>(theme.colorPalette, []),
    dominantShotTypes: parseJson<string[]>(theme.dominantShotTypes, []),
    timeOfDay: parseJson<string[]>(theme.timeOfDay, []),
  };

  return <ThemeEditor theme={serialized} />;
}
