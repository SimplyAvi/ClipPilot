import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateCharacterSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  name: z.string().min(1, "Character name is required").max(100),
  ageAppearance: z.number().int().min(18).max(80).nullable().optional(),
  description: z.string().max(2000).optional(),
  personalityNotes: z.string().max(2000).optional(),
  elevenLabsVoiceId: z.string().optional(),
  voiceName: z.string().optional(),
  speakingPace: z.enum(["slow", "normal", "fast"]).default("normal"),
  emotionalRange: z.enum(["restrained", "moderate", "expressive"]).default("moderate"),
  accent: z.string().max(100).optional(),
  confirmedFictional: z.boolean().default(false),
});

// ─── GET /api/characters?projectId=xxx ───────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ data: null, error: "projectId is required" }, { status: 400 });
  }

  try {
    const characters = await db.character.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: characters, error: null });
  } catch (err) {
    console.error("[GET /api/characters]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch characters" }, { status: 500 });
  }
}

// ─── POST /api/characters ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { projectId, name, ageAppearance, description, personalityNotes,
    elevenLabsVoiceId, voiceName, speakingPace, emotionalRange, accent,
    confirmedFictional } = parsed.data;

  // Verify project exists
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  }

  try {
    const character = await db.character.create({
      data: {
        projectId,
        name,
        ageAppearance: ageAppearance ?? null,
        description: description || null,
        personalityNotes: personalityNotes || null,
        elevenLabsVoiceId: elevenLabsVoiceId || null,
        voiceName: voiceName || null,
        speakingPace,
        emotionalRange,
        accent: accent || null,
        confirmedFictional,
      },
    });
    return NextResponse.json({ data: character, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/characters]", err);
    return NextResponse.json({ data: null, error: "Failed to create character" }, { status: 500 });
  }
}
