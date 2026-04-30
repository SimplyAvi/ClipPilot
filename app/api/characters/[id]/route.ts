import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const UpdateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().max(60).nullable().optional(),
  age: z.number().int().min(5).max(100).nullable().optional(),
  gender: z.string().max(60).nullable().optional(),
  ethnicity: z.string().max(1000).nullable().optional(),
  physicalDescription: z.string().max(4000).nullable().optional(),
  biography: z.string().max(8000).nullable().optional(),
  personality: z.string().max(4000).nullable().optional(),
  motivations: z.string().max(4000).nullable().optional(),
  fears: z.string().max(4000).nullable().optional(),
  quirks: z.string().max(4000).nullable().optional(),
  emotionalRange: z.string().max(80).nullable().optional(),
  gestureTendencies: z.string().max(4000).nullable().optional(),
  forbiddenChanges: z.string().max(4000).nullable().optional(),
  portraitPath: z.string().nullable().optional(),
  portraitPrompt: z.string().max(8000).nullable().optional(),
  portraitStyle: z.string().max(80).nullable().optional(),
  voiceId: z.string().nullable().optional(),
  voicePace: z.string().nullable().optional(),
  voiceAccent: z.string().max(1000).nullable().optional(),
  voiceTone: z.string().max(4000).nullable().optional(),
  voiceNotes: z.string().max(4000).nullable().optional(),
  tags: z.string().max(1000).nullable().optional(),
  isArchived: z.boolean().optional(),
}).strict();

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const character = await db.character.findUnique({
      where: { id: params.id },
      include: {
        projectCharacters: {
          include: { project: { select: { id: true, name: true, status: true, thumbnailPath: true } } },
          orderBy: { addedAt: "desc" },
        },
        portraitGenerations: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!character) {
      return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[GET /api/characters/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch character" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return updateCharacter(request, params.id);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return updateCharacter(request, params.id);
}

async function updateCharacter(request: Request, id: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const character = await db.character.update({
      where: { id },
      data: parsed.data,
      include: { projectCharacters: true },
    });
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[PUT /api/characters/[id]]", err);
    return NextResponse.json({ data: null, error: "Character not found or update failed" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const character = await db.character.update({
      where: { id: params.id },
      data: { isArchived: true },
    });
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[DELETE /api/characters/[id]]", err);
    return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
  }
}
