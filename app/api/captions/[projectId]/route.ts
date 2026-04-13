/**
 * /api/captions/[projectId]
 *
 * GET  — fetch transcription + all caption segments for a project
 * PUT  — bulk-replace all caption segments (editor save)
 * PATCH — update the caption style for a project
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

const SegmentSchema = z.object({
  id: z.string().optional(),
  index: z.number().int().min(0),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  text: z.string().min(1),
});

const PutBodySchema = z.object({
  segments: z.array(SegmentSchema),
});

const CaptionStyleSchema = z.object({
  fontSize: z.number().int().min(8).max(72).optional(),
  fontColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  position: z.enum(["bottom", "top", "center"]).optional(),
  fontFamily: z.string().optional(),
});

const PatchBodySchema = z.object({
  captionStyle: CaptionStyleSchema,
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;

  const transcription = await db.transcription.findUnique({
    where: { projectId },
    include: {
      segments: { orderBy: { index: "asc" } },
    },
  });

  return NextResponse.json({ data: transcription ?? null });
}

// ─── PUT — bulk-replace segments ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;

  let body: z.infer<typeof PutBodySchema>;
  try {
    body = PutBodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const transcription = await db.transcription.findUnique({ where: { projectId } });
  if (!transcription) {
    return NextResponse.json(
      { error: "No transcription found — run auto-generate first" },
      { status: 404 }
    );
  }

  // Delete all existing segments and re-create
  await db.captionSegment.deleteMany({ where: { transcriptionId: transcription.id } });

  const created = await db.transcription.update({
    where: { projectId },
    data: {
      segments: {
        create: body.segments.map((s) => ({
          index: s.index,
          startSec: s.startSec,
          endSec: s.endSec,
          text: s.text,
        })),
      },
    },
    include: { segments: { orderBy: { index: "asc" } } },
  });

  return NextResponse.json({ data: created });
}

// ─── PATCH — update caption style ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;

  let body: z.infer<typeof PatchBodySchema>;
  try {
    body = PatchBodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const transcription = await db.transcription.findUnique({ where: { projectId } });
  if (!transcription) {
    return NextResponse.json({ error: "No transcription found" }, { status: 404 });
  }

  const updated = await db.transcription.update({
    where: { projectId },
    data: { captionStyle: body.captionStyle },
  });

  return NextResponse.json({ data: updated });
}
