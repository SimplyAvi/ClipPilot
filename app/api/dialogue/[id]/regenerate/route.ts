/**
 * ADR (Automatic Dialogue Replacement) — regenerate a single dialogue line.
 *
 * POST /api/dialogue/[id]/regenerate
 *
 * Optionally accepts { text, deliveryDirection } to override before re-generating.
 * Re-generates ONLY that line's audio. Does not touch video or other lines.
 * If the shot has a lip-synced video and a mixed audio track, those are marked
 * stale (cleared) so the caller knows to re-run audio-mix + lip-sync.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSingleLine, type DialogueLineInput } from "@/lib/generators/dialogue";
import { uploadToR2 } from "@/lib/storage";

const RegenerateSchema = z.object({
  text: z.string().min(1).max(5000).optional(),
  deliveryDirection: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = RegenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Load line + character for voice settings
  const line = await db.dialogueLine.findUnique({
    where: { id: params.id },
    include: {
      character: true,
      shot: { select: { id: true, sceneId: true, scene: { select: { projectId: true } } } },
    },
  });

  if (!line) {
    return NextResponse.json({ data: null, error: "Dialogue line not found" }, { status: 404 });
  }

  if (!line.character?.voiceId) {
    return NextResponse.json(
      { data: null, error: "Character has no ElevenLabs voice configured" },
      { status: 422 }
    );
  }

  // Apply overrides if provided
  const text = parsed.data.text ?? line.text;
  const deliveryDirection =
    parsed.data.deliveryDirection !== undefined
      ? parsed.data.deliveryDirection
      : line.deliveryDirection;

  // Update text/direction first if changed
  if (parsed.data.text !== undefined || parsed.data.deliveryDirection !== undefined) {
    await db.dialogueLine.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.text !== undefined && { text: parsed.data.text }),
        ...(parsed.data.deliveryDirection !== undefined && { deliveryDirection: parsed.data.deliveryDirection }),
      },
    });
  }

  // Mark as generating
  await db.dialogueLine.update({
    where: { id: params.id },
    data: { status: "GENERATING" },
  });

  try {
    const input: DialogueLineInput = {
      id: line.id,
      lineIndex: line.lineIndex,
      text,
      deliveryDirection,
      characterVoiceId: line.character.voiceId,
      speakingPace: (line.character.voicePace as "slow" | "normal" | "fast") ?? "normal",
      emotionalRange: (line.character.emotionalRange as "restrained" | "moderate" | "expressive") ?? "moderate",
    };

    const { audioBuffer, estimatedDurationSec } = await generateSingleLine(input);

    const sceneId = line.shot.sceneId;
    const shotId = line.shot.id;
    const r2Key = `projects/scenes/${sceneId}/shots/${shotId}/dialogue/line-${line.lineIndex}.mp3`;
    await uploadToR2(r2Key, audioBuffer, "audio/mpeg");

    // Update line record
    await db.dialogueLine.update({
      where: { id: params.id },
      data: {
        status: "COMPLETE",
        audioPath: r2Key,
        durationSec: estimatedDurationSec,
      },
    });

    // Mark shot's audio mix + lip sync stale so caller re-runs them
    await db.shot.update({
      where: { id: shotId },
      data: {
        mixedAudioPath: null,
        dialogueStemPath: null,
        lipSyncedVideoPath: null,
        lipSyncStatus: null,
      },
    });

    console.log(`[ADR] Line ${line.lineIndex} regenerated — ${r2Key}`);
    return NextResponse.json({
      data: { r2Key, estimatedDurationSec, shotStale: true },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/dialogue/[id]/regenerate]", msg);

    await db.dialogueLine.update({
      where: { id: params.id },
      data: { status: "FAILED" },
    });

    return NextResponse.json({ data: null, error: `Regeneration failed: ${msg}` }, { status: 500 });
  }
}
