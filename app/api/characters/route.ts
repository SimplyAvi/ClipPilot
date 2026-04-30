import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const CharacterSchema = z.object({
  name: z.string().min(1, "Character name is required").max(100),
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
  projectId: z.string().optional(),
  roleInProject: z.string().max(120).nullable().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const archived = searchParams.get("archived") === "true";
  const projectId = searchParams.get("projectId");
  const sort = searchParams.get("sort") ?? "recent";

  try {
    const characters = await db.character.findMany({
      where: {
        isArchived: archived,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { tags: { contains: q, mode: "insensitive" } },
                { physicalDescription: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(projectId
          ? { projectCharacters: { some: { projectId } } }
          : {}),
      },
      include: {
        projectCharacters: {
          include: { project: { select: { id: true, name: true, status: true, thumbnailPath: true } } },
          orderBy: { addedAt: "desc" },
        },
      },
      orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
    });

    const sorted =
      sort === "used"
        ? [...characters].sort((a, b) => b.projectCharacters.length - a.projectCharacters.length)
        : characters;

    return NextResponse.json({ data: sorted, error: null });
  } catch (err) {
    console.error("[GET /api/characters]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch characters" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { projectId, roleInProject, ...characterData } = parsed.data;

  try {
    const character = await db.character.create({
      data: {
        ...characterData,
        ...(projectId
          ? {
              projectCharacters: {
                create: { projectId, roleInProject: roleInProject ?? characterData.role ?? null },
              },
            }
          : {}),
      },
      include: { projectCharacters: true },
    });
    return NextResponse.json({ data: character, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/characters]", err);
    return NextResponse.json({ data: null, error: "Failed to create character" }, { status: 500 });
  }
}
