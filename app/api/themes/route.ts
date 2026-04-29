/**
 * GET  /api/themes — List all themes (sorted by usageCount desc)
 * POST /api/themes — Create a new theme (from analysis results or manual)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourcePlatform: z.string().optional(),
  referenceFramePaths: z.array(z.string()).optional(),
  coverFrameIndex: z.number().int().min(0).optional(),
  colorPalette: z.array(z.string()).optional(),
  colorMood: z.string().optional(),
  colorTemperature: z.string().optional(),
  saturation: z.string().optional(),
  contrast: z.string().optional(),
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
  analysisRawJson: z.string().optional(),
});

export async function GET() {
  try {
    const themes = await db.theme.findMany({
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { projectsUsingTheme: true } },
      },
    });
    return NextResponse.json({ data: themes, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const theme = await db.theme.create({
      data: {
        name: d.name,
        description: d.description,
        sourceUrl: d.sourceUrl,
        sourcePlatform: d.sourcePlatform,
        referenceFramePaths: d.referenceFramePaths
          ? JSON.stringify(d.referenceFramePaths)
          : undefined,
        coverFrameIndex: d.coverFrameIndex ?? 0,
        colorPalette: d.colorPalette ? JSON.stringify(d.colorPalette) : undefined,
        colorMood: d.colorMood,
        colorTemperature: d.colorTemperature,
        saturation: d.saturation,
        contrast: d.contrast,
        genre: d.genre,
        tone: d.tone,
        visualStyle: d.visualStyle,
        audioStyle: d.audioStyle,
        lightingStyle: d.lightingStyle,
        cameraMovement: d.cameraMovement,
        dominantShotTypes: d.dominantShotTypes
          ? JSON.stringify(d.dominantShotTypes)
          : undefined,
        pacing: d.pacing,
        avgShotDurationSeconds: d.avgShotDurationSeconds,
        characterAgeRange: d.characterAgeRange,
        characterAppearance: d.characterAppearance,
        characterMood: d.characterMood,
        primaryEnvironment: d.primaryEnvironment,
        timeOfDay: d.timeOfDay ? JSON.stringify(d.timeOfDay) : undefined,
        environmentDescription: d.environmentDescription,
        musicGenre: d.musicGenre,
        musicMood: d.musicMood,
        musicTempo: d.musicTempo,
        audioNotes: d.audioNotes,
        visualPromptModifier: d.visualPromptModifier,
        audioPromptModifier: d.audioPromptModifier,
        cinematographyNotes: d.cinematographyNotes,
        analysisRawJson: d.analysisRawJson,
      },
    });
    return NextResponse.json({ data: theme, error: null }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
