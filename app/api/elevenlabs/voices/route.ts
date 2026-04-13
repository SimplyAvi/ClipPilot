import { NextResponse } from "next/server";
import { getVoices } from "@/lib/voice-client";

/**
 * GET /api/elevenlabs/voices
 * Returns all voices available on the configured ElevenLabs account.
 * Cached for 5 minutes at the edge so the dropdown doesn't hammer the API.
 */
export const revalidate = 300; // 5-minute ISR cache

export async function GET() {
  if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === "...") {
    return NextResponse.json(
      { data: null, error: "ELEVENLABS_API_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    const voices = await getVoices();
    // Sort: premade first, then alphabetical within each category
    const sorted = voices.sort((a, b) => {
      if (a.category === b.category) return a.name.localeCompare(b.name);
      return a.category === "premade" ? -1 : 1;
    });

    return NextResponse.json({ data: sorted, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/elevenlabs/voices]", msg);
    return NextResponse.json({ data: null, error: msg }, { status: 502 });
  }
}
