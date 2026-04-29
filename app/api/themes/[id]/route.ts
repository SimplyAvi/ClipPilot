/**
 * GET    /api/themes/[id] — Get a single theme
 * PATCH  /api/themes/[id] — Update a theme
 * DELETE /api/themes/[id] — Delete a theme and its reference frames
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getLocalStoragePath } from "@/lib/storage";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  coverFrameIndex: z.number().int().min(0).optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  visualStyle: z.string().optional(),
  audioStyle: z.string().optional(),
  lightingStyle: z.string().optional(),
  cameraMovement: z.string().optional(),
  dominantShotTypes: z.array(z.string()).optional(),
  pacing: z.string().optional(),
  avgShotDurationSeconds: z.number().optional(),
  characterAgeRange: z.string().optional(),
  characterAppearance: z.string().optional(),
  characterMood: z.string().optional(),
  primaryEnvironment: z.string().optional(),
  timeOfDay: z.array(z.string()).optional(),
  environmentDescription: z.string().optional(),
  musicGenre: z.string().optional(),
  musicMood: z.string().optional(),
  musicTempo: z.string().optional(),
  audioNotes: z.string().optional(),
  visualPromptModifier: z.string().optional(),
  audioPromptModifier: z.string().optional(),
  cinematographyNotes: z.string().optional(),
}).partial();

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const theme = await db.theme.findUnique({
      where: { id: params.id },
      include: {
        projectsUsingTheme: {
          select: { id: true, name: true, status: true, platform: true, thumbnailPath: true },
        },
        _count: { select: { projectsUsingTheme: true } },
      },
    });
    if (!theme) {
      return NextResponse.json({ data: null, error: "Theme not found" }, { status: 404 });
    }
    return NextResponse.json({ data: theme, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const theme = await db.theme.update({
      where: { id: params.id },
      data: {
        ...d,
        dominantShotTypes: d.dominantShotTypes
          ? JSON.stringify(d.dominantShotTypes)
          : undefined,
        timeOfDay: d.timeOfDay ? JSON.stringify(d.timeOfDay) : undefined,
      },
    });
    return NextResponse.json({ data: theme, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const theme = await db.theme.findUnique({ where: { id: params.id } });
    if (!theme) {
      return NextResponse.json({ data: null, error: "Theme not found" }, { status: 404 });
    }

    // Delete reference frames from disk
    try {
      const storageRoot = await getLocalStoragePath();
      const themeDir = path.join(storageRoot, "themes", params.id);
      if (fs.existsSync(themeDir)) {
        fs.rmSync(themeDir, { recursive: true, force: true });
      }
    } catch {
      // Non-fatal — continue with DB deletion
    }

    await db.theme.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
