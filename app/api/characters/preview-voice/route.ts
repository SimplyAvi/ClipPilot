import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVoicePreview } from "@/lib/voice-client";

const PreviewSchema = z.object({
  voiceId: z.string().min(1, "voiceId is required"),
  text: z.string().max(300).optional(),
  speakingPace: z.string().default("normal"),
  emotionalRange: z.string().default("moderate"),
});

/**
 * POST /api/characters/preview-voice
 *
 * Generates a short TTS audio clip using ElevenLabs and streams it back
 * as audio/mpeg so the client can play it directly via a Blob URL.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { voiceId, text, speakingPace, emotionalRange } = parsed.data;

  try {
    const audioBuffer = await generateVoicePreview(
      voiceId,
      text ?? null,
      normalizePace(speakingPace),
      normalizeEmotionalRange(emotionalRange)
    );

    // Return raw audio so the client can create a Blob URL for <audio>
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[preview-voice]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function normalizePace(value: string): "slow" | "normal" | "fast" {
  const normalized = value.toLowerCase();
  if (["slow", "measured"].includes(normalized)) return "slow";
  if (["fast", "quick"].includes(normalized)) return "fast";
  return "normal";
}

function normalizeEmotionalRange(value: string): "restrained" | "moderate" | "expressive" {
  const normalized = value.toLowerCase();
  if (["low", "restrained"].includes(normalized)) return "restrained";
  if (["high", "expressive"].includes(normalized)) return "expressive";
  return "moderate";
}
