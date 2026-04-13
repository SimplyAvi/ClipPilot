import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PatchCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ageAppearance: z.number().int().min(18).max(80).nullable().optional(),
  description: z.string().max(2000).optional(),
  personalityNotes: z.string().max(2000).optional(),
  elevenLabsVoiceId: z.string().optional().nullable(),
  voiceName: z.string().optional().nullable(),
  speakingPace: z.enum(["slow", "normal", "fast"]).optional(),
  emotionalRange: z.enum(["restrained", "moderate", "expressive"]).optional(),
  accent: z.string().max(100).optional().nullable(),
  confirmedFictional: z.boolean().optional(),
}).strict();

// ─── GET /api/characters/[id] ────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const character = await db.character.findUnique({ where: { id: params.id } });
    if (!character) {
      return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[GET /api/characters/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch character" }, { status: 500 });
  }
}

// ─── PATCH /api/characters/[id] ──────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  try {
    const character = await db.character.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[PATCH /api/characters/[id]]", err);
    return NextResponse.json(
      { data: null, error: "Character not found or update failed" },
      { status: 404 }
    );
  }
}

// ─── DELETE /api/characters/[id] ─────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await db.character.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    console.error("[DELETE /api/characters/[id]]", err);
    return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
  }
}
