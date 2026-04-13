import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const UpdateDialogueLineSchema = z.object({
  text: z.string().min(1).max(5000).optional(),
  deliveryDirection: z.string().max(500).nullable().optional(),
  characterId: z.string().nullable().optional(),
  lineIndex: z.number().int().min(0).optional(),
});

// ─── GET /api/dialogue/[id] ───────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const line = await db.dialogueLine.findUnique({
      where: { id: params.id },
      include: {
        character: { select: { id: true, name: true, elevenLabsVoiceId: true, speakingPace: true, emotionalRange: true } },
      },
    });

    if (!line) {
      return NextResponse.json({ data: null, error: "Dialogue line not found" }, { status: 404 });
    }

    return NextResponse.json({ data: line, error: null });
  } catch (err) {
    console.error("[GET /api/dialogue/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch dialogue line" }, { status: 500 });
  }
}

// ─── PATCH /api/dialogue/[id] ─────────────────────────────────────────────────

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

  const parsed = UpdateDialogueLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const existing = await db.dialogueLine.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ data: null, error: "Dialogue line not found" }, { status: 404 });
  }

  try {
    const updated = await db.dialogueLine.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.text !== undefined && { text: parsed.data.text }),
        ...(parsed.data.deliveryDirection !== undefined && { deliveryDirection: parsed.data.deliveryDirection }),
        ...(parsed.data.characterId !== undefined && { characterId: parsed.data.characterId }),
        ...(parsed.data.lineIndex !== undefined && { lineIndex: parsed.data.lineIndex }),
        // Reset audio when text/direction changes
        ...(parsed.data.text !== undefined || parsed.data.deliveryDirection !== undefined
          ? { status: "PENDING", audioPath: null, startTimeSec: null, endTimeSec: null, durationSec: null }
          : {}),
      },
    });
    return NextResponse.json({ data: updated, error: null });
  } catch (err) {
    console.error("[PATCH /api/dialogue/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to update dialogue line" }, { status: 500 });
  }
}

// ─── DELETE /api/dialogue/[id] ────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const existing = await db.dialogueLine.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ data: null, error: "Dialogue line not found" }, { status: 404 });
  }

  try {
    await db.dialogueLine.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { id: params.id }, error: null });
  } catch (err) {
    console.error("[DELETE /api/dialogue/[id]]", err);
    return NextResponse.json({ data: null, error: "Failed to delete dialogue line" }, { status: 500 });
  }
}
