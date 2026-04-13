/**
 * POST /api/shots/[id]/lip-sync
 *
 * Triggers lip sync for a single shot.
 * Requires:
 *   - shot.generatedVideoPath (raw video R2 key)
 *   - shot.mixedAudioPath (dialogue+music mix R2 key)
 *
 * Returns SKIPPED status when SYNC_LABS_API_KEY is not configured.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lipSyncShot } from "@/lib/generators/lip-sync";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const shot = await db.shot.findUnique({
    where: { id: params.id },
    include: { scene: { select: { projectId: true } } },
  });

  if (!shot) {
    return NextResponse.json({ data: null, error: "Shot not found" }, { status: 404 });
  }

  if (!shot.generatedVideoPath) {
    return NextResponse.json(
      { data: null, error: "Shot has no generated video — run video generation first" },
      { status: 422 }
    );
  }

  if (!shot.mixedAudioPath) {
    return NextResponse.json(
      { data: null, error: "Shot has no mixed audio — run audio mix first" },
      { status: 422 }
    );
  }

  try {
    const result = await lipSyncShot(
      shot.scene.projectId,
      shot.sceneId,
      shot.id,
      shot.generatedVideoPath,
      shot.mixedAudioPath
    );

    await db.shot.update({
      where: { id: shot.id },
      data: {
        lipSyncStatus: result.status,
        lipSyncedVideoPath: result.r2Key ?? shot.lipSyncedVideoPath,
      },
    });

    return NextResponse.json({ data: result, error: result.error ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/shots/[id]/lip-sync]", msg);
    await db.shot.update({
      where: { id: shot.id },
      data: { lipSyncStatus: "FAILED" },
    });
    return NextResponse.json({ data: null, error: `Lip sync failed: ${msg}` }, { status: 500 });
  }
}
