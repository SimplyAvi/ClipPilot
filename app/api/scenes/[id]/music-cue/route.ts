import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// ─── Schema ───────────────────────────────────────────────────────────────────

const MusicCueSchema = z.object({
  assetId: z.string().min(1, "assetId is required"),
  startPointSec: z.number().min(0).default(0),
  fadeInSec: z.number().min(0).max(30).default(2),
  fadeOutSec: z.number().min(0).max(30).default(3),
  volumeDb: z.number().min(-40).max(0).default(-12),
});

// ─── GET /api/scenes/[id]/music-cue ──────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cue = await db.sceneMusicCue.findUnique({
      where: { sceneId: params.id },
      include: { asset: true },
    });
    return NextResponse.json({ data: cue, error: null });
  } catch (err) {
    console.error("[GET /api/scenes/[id]/music-cue]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch music cue" }, { status: 500 });
  }
}

// ─── PUT /api/scenes/[id]/music-cue ──────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MusicCueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Verify scene exists
  const scene = await db.scene.findUnique({ where: { id: params.id } });
  if (!scene) {
    return NextResponse.json({ data: null, error: "Scene not found" }, { status: 404 });
  }

  // Verify asset exists and is a music asset with commercial use
  const asset = await db.asset.findUnique({ where: { id: parsed.data.assetId } });
  if (!asset) {
    return NextResponse.json({ data: null, error: "Asset not found" }, { status: 404 });
  }
  if (asset.type !== "MUSIC") {
    return NextResponse.json({ data: null, error: "Asset must be of type MUSIC" }, { status: 422 });
  }
  if (asset.commercialUse === false) {
    return NextResponse.json({ data: null, error: "Asset is not cleared for commercial use" }, { status: 422 });
  }

  try {
    const cue = await db.sceneMusicCue.upsert({
      where: { sceneId: params.id },
      create: {
        sceneId: params.id,
        assetId: parsed.data.assetId,
        startPointSec: parsed.data.startPointSec,
        fadeInSec: parsed.data.fadeInSec,
        fadeOutSec: parsed.data.fadeOutSec,
        volumeDb: parsed.data.volumeDb,
      },
      update: {
        assetId: parsed.data.assetId,
        startPointSec: parsed.data.startPointSec,
        fadeInSec: parsed.data.fadeInSec,
        fadeOutSec: parsed.data.fadeOutSec,
        volumeDb: parsed.data.volumeDb,
      },
      include: { asset: true },
    });
    return NextResponse.json({ data: cue, error: null });
  } catch (err) {
    console.error("[PUT /api/scenes/[id]/music-cue]", err);
    return NextResponse.json({ data: null, error: "Failed to save music cue" }, { status: 500 });
  }
}

// ─── DELETE /api/scenes/[id]/music-cue ───────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await db.sceneMusicCue.findUnique({ where: { sceneId: params.id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: "No music cue for this scene" }, { status: 404 });
    }
    await db.sceneMusicCue.delete({ where: { sceneId: params.id } });
    return NextResponse.json({ data: { sceneId: params.id }, error: null });
  } catch (err) {
    console.error("[DELETE /api/scenes/[id]/music-cue]", err);
    return NextResponse.json({ data: null, error: "Failed to delete music cue" }, { status: 500 });
  }
}
