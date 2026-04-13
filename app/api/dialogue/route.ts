import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateDialogueLineSchema = z.object({
  shotId: z.string().min(1),
  characterId: z.string().nullable().optional(),
  lineIndex: z.number().int().min(0),
  text: z.string().min(1).max(5000),
  deliveryDirection: z.string().max(500).nullable().optional(),
});

// ─── GET /api/dialogue?shotId=xxx ────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shotId = searchParams.get("shotId");

  if (!shotId) {
    return NextResponse.json({ data: null, error: "shotId is required" }, { status: 400 });
  }

  try {
    const lines = await db.dialogueLine.findMany({
      where: { shotId },
      include: { character: { select: { id: true, name: true, elevenLabsVoiceId: true, speakingPace: true, emotionalRange: true } } },
      orderBy: { lineIndex: "asc" },
    });
    return NextResponse.json({ data: lines, error: null });
  } catch (err) {
    console.error("[GET /api/dialogue]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch dialogue lines" }, { status: 500 });
  }
}

// ─── POST /api/dialogue ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateDialogueLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { shotId, characterId, lineIndex, text, deliveryDirection } = parsed.data;

  const shot = await db.shot.findUnique({ where: { id: shotId } });
  if (!shot) {
    return NextResponse.json({ data: null, error: "Shot not found" }, { status: 404 });
  }

  try {
    const line = await db.dialogueLine.create({
      data: {
        shotId,
        characterId: characterId ?? null,
        lineIndex,
        text,
        deliveryDirection: deliveryDirection ?? null,
      },
    });
    return NextResponse.json({ data: line, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/dialogue]", err);
    return NextResponse.json({ data: null, error: "Failed to create dialogue line" }, { status: 500 });
  }
}
