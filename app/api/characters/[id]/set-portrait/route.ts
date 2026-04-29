import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const SetPortraitSchema = z.object({
  portraitUrl: z.string().min(1),
  portraitPrompt: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SetPortraitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const flagged = await db.characterPortraitGeneration.findFirst({
    where: { characterId: params.id, imagePath: parsed.data.portraitUrl, flagged: true },
  });
  if (flagged) {
    return NextResponse.json({ data: null, error: "Flagged portraits cannot be saved" }, { status: 422 });
  }

  try {
    const character = await db.character.update({
      where: { id: params.id },
      data: {
        portraitPath: parsed.data.portraitUrl,
        portraitPrompt: parsed.data.portraitPrompt,
      },
    });
    return NextResponse.json({ data: character, error: null });
  } catch (err) {
    console.error("[POST /api/characters/[id]/set-portrait]", err);
    return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
  }
}
