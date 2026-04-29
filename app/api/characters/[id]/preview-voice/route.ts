import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVoicePreview } from "@/lib/voice-client";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const character = await db.character.findUnique({ where: { id: params.id } });
  if (!character) {
    return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
  }
  if (!character.voiceId) {
    return NextResponse.json({ data: null, error: "Assign a voice first" }, { status: 422 });
  }

  try {
    const audioBuffer = await generateVoicePreview(
      character.voiceId,
      "This is a short preview of the character voice.",
      (character.voicePace as "slow" | "normal" | "fast") ?? "normal",
      (character.emotionalRange as "restrained" | "moderate" | "expressive") ?? "moderate"
    );
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Voice preview failed";
    console.error("[POST /api/characters/[id]/preview-voice]", msg);
    return NextResponse.json({ data: null, error: msg }, { status: 502 });
  }
}
