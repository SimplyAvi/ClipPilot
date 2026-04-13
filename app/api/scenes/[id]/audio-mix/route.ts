/**
 * POST /api/scenes/[id]/audio-mix
 *
 * Triggers the audio mix pipeline for all shots in a scene:
 *  1. Loads dialogue lines + timing per shot
 *  2. Loads the scene's music cue (if any)
 *  3. Calls mixSceneAudio() per shot
 *  4. Updates Shot DB record with the resulting R2 keys
 *
 * Runs synchronously (one shot at a time). Suitable for scenes with ≤10 shots.
 * For large productions, move this into a BullMQ worker.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mixSceneAudio, type MixInput, type MixDialogueLine } from "@/lib/generators/audio-mix";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const scene = await db.scene.findUnique({
    where: { id: params.id },
    include: {
      musicCue: { include: { asset: true } },
      shots: {
        orderBy: { shotNumber: "asc" },
        include: {
          dialogueLines: {
            where: { status: "COMPLETE" },
            orderBy: { lineIndex: "asc" },
          },
        },
      },
    },
  });

  if (!scene) {
    return NextResponse.json({ data: null, error: "Scene not found" }, { status: 404 });
  }

  const results: Array<{ shotId: string; status: "ok" | "error"; error?: string }> = [];

  for (let i = 0; i < scene.shots.length; i++) {
    const shot = scene.shots[i];

    // Calculate total shot duration (use shot.duration field)
    const totalDurationSec = shot.duration ?? 3;

    const dialogueLines: MixDialogueLine[] = shot.dialogueLines
      .filter((dl) => dl.audioPath && dl.startTimeSec !== null)
      .map((dl) => ({
        r2Key: dl.audioPath!,
        startTimeSec: dl.startTimeSec!,
        durationSec: dl.durationSec ?? 1,
      }));

    const musicCue = scene.musicCue;
    const mixInput: MixInput = {
      dialogueLines,
      musicR2Key: null,          // asset stored externally; use sourceUrl
      musicSourceUrl: musicCue?.asset.sourceUrl ?? null,
      musicStartPointSec: musicCue?.startPointSec ?? 0,
      musicFadeInSec: musicCue?.fadeInSec ?? 2,
      musicFadeOutSec: musicCue?.fadeOutSec ?? 3,
      musicVolumeDb: musicCue?.volumeDb ?? -12,
      totalDurationSec,
    };

    try {
      const output = await mixSceneAudio(params.id, shot.id, mixInput);

      await db.shot.update({
        where: { id: shot.id },
        data: {
          mixedAudioPath: output.fullMixR2Key,
          dialogueStemPath: output.dialogueStemR2Key,
          musicStemPath: output.musicStemR2Key ?? null,
        },
      });

      results.push({ shotId: shot.id, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[audio-mix] Shot ${shot.id} failed:`, msg);
      results.push({ shotId: shot.id, status: "error", error: msg });
    }
  }

  const failed = results.filter((r) => r.status === "error");
  return NextResponse.json({
    data: { results, successCount: results.length - failed.length, failCount: failed.length },
    error: failed.length > 0 ? `${failed.length} shot(s) failed to mix` : null,
  });
}
