/**
 * Dialogue audio generation.
 *
 * For each dialogue line in a shot:
 * 1. Calls ElevenLabs TTS with the character's voice ID + settings
 * 2. Uploads audio to Cloudflare R2
 * 3. Accumulates timing (startTimeSec, endTimeSec, durationSec) by
 *    sequencing lines with a short pause between them
 * 4. Updates the DialogueLine DB record with results
 *
 * Timing accuracy: ElevenLabs does not return duration, so we estimate
 * from word count at the character's speaking pace.
 * The audio-mix step will use the actual file duration via FFmpeg.
 */

import { textToSpeech, buildVoiceSettings, applyPaceToText } from "@/lib/voice-client";
import { storage } from "@/lib/storage";
import { dialoguePath, slugify } from "@/lib/storage/naming";
import { appendGenerationLog } from "@/lib/storage/generation-log";
import { db } from "@/lib/db";
import { recordElevenLabsCost } from "@/lib/analytics/cost-tracker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DialogueLineInput {
  id: string;            // DB DialogueLine.id
  lineIndex: number;
  text: string;
  deliveryDirection: string | null;
  characterVoiceId: string;
  speakingPace: "slow" | "normal" | "fast";
  emotionalRange: "restrained" | "moderate" | "expressive";
}

export interface DialogueTiming {
  lineId: string;
  audioPath: string;    // R2 key
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

// Silence gap between consecutive lines (seconds)
const LINE_PAUSE_SEC = 0.25;

// Estimated words-per-minute by pace
const WPM: Record<string, number> = { slow: 110, normal: 140, fast: 175 };

// ─── Single-line generation ───────────────────────────────────────────────────

/**
 * Generate audio for a single dialogue line.
 * Returns the audio buffer and estimated duration.
 * Does NOT update the database or upload — caller handles that.
 */
export async function generateSingleLine(line: DialogueLineInput): Promise<{
  audioBuffer: Buffer;
  estimatedDurationSec: number;
}> {
  const settings = buildVoiceSettings(line.speakingPace, line.emotionalRange);

  // Apply pace markers to text (ElevenLabs SSML-style)
  let text = applyPaceToText(line.text.trim(), line.speakingPace);

  // Prepend delivery direction as an acting note between brackets
  // ElevenLabs ignores unknown bracket content but the framing helps
  // the model interpret tone when combined with voice settings
  if (line.deliveryDirection?.trim()) {
    text = `[${line.deliveryDirection.trim()}] ${text}`;
  }

  const ab = await textToSpeech(line.characterVoiceId, text, settings);
  const audioBuffer = Buffer.from(ab);

  // Estimate duration from word count (the real duration is in the audio bytes
  // but parsing MP3 headers here adds complexity — FFmpeg will use the real value)
  const wordCount = line.text.trim().split(/\s+/).length;
  const wpm = WPM[line.speakingPace] ?? 140;
  const estimatedDurationSec = Math.max((wordCount / wpm) * 60, 0.5);

  return { audioBuffer, estimatedDurationSec };
}

// ─── Shot-level generation ────────────────────────────────────────────────────

/**
 * Generate audio for every dialogue line in a shot.
 * Lines are processed in lineIndex order; timing is accumulated sequentially.
 * Each line's DB record is updated on completion/failure.
 *
 * Returns timing data for downstream audio mixing.
 */
export async function generateShotDialogue(
  sceneId: string,
  shotId: string,
  lines: DialogueLineInput[],
  projectId?: string
): Promise<DialogueTiming[]> {
  const sorted = [...lines].sort((a, b) => a.lineIndex - b.lineIndex);
  const timings: DialogueTiming[] = [];
  let cursor = 0; // running position in seconds

  for (const line of sorted) {
    await db.dialogueLine.update({
      where: { id: line.id },
      data: { status: "GENERATING" },
    });

    try {
      const { audioBuffer, estimatedDurationSec } = await generateSingleLine(line);

      const shot = await db.shot.findUnique({
        where: { id: shotId },
        include: { scene: { include: { project: { select: { projectSlug: true, name: true } } } } },
      });
      const projectSlug = shot?.scene.project.projectSlug ?? slugify(shot?.scene.project.name ?? "project");
      const stored = await storage.save(
        dialoguePath(projectSlug, shot?.scene.sceneNumber ?? 1, line.lineIndex + 1, "character", line.lineIndex + 1, 1).replace(/\.wav$/, ".mp3"),
        audioBuffer,
        "audio/mpeg",
        { sceneId, shotId, dialogueLineId: line.id, provider: "elevenlabs" }
      );

      const startTimeSec = cursor;
      const endTimeSec = cursor + estimatedDurationSec;
      cursor = endTimeSec + LINE_PAUSE_SEC;

      await db.dialogueLine.update({
        where: { id: line.id },
        data: {
          status: "COMPLETE",
          audioPath: stored.path,
          startTimeSec,
          endTimeSec,
          durationSec: estimatedDurationSec,
        },
      });

      // Fire-and-forget cost recording (char count as proxy for ElevenLabs billing)
      if (projectId) {
        void recordElevenLabsCost(projectId, line.text.length);
      }

      await appendGenerationLog(projectSlug, {
        timestamp: new Date().toISOString(),
        type: "dialogue",
        provider: "elevenlabs",
        model: "tts",
        outputPath: stored.path,
        durationSeconds: estimatedDurationSec,
        cost: 0,
        status: "success",
      }).catch(() => undefined);

      timings.push({ lineId: line.id, audioPath: stored.path, startTimeSec, endTimeSec, durationSec: estimatedDurationSec });
      console.log(`[dialogue] Line ${line.lineIndex} done — ~${estimatedDurationSec.toFixed(2)}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[dialogue] Line ${line.lineIndex} failed:`, msg);
      await db.dialogueLine.update({
        where: { id: line.id },
        data: { status: "FAILED" },
      });
    }
  }

  return timings;
}
