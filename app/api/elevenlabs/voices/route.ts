import { NextResponse } from "next/server";
import { getVoices } from "@/lib/voice-client";
import { getProviderKey } from "@/lib/provider-keys";

/**
 * GET /api/elevenlabs/voices
 * Returns all voices available on the configured ElevenLabs account.
 * Cached for 5 minutes at the edge so the dropdown doesn't hammer the API.
 */
export const revalidate = 300; // 5-minute ISR cache

export async function GET() {
  if (!(await getProviderKey("elevenlabs"))) {
    return NextResponse.json(
      { data: [], error: "ElevenLabs is not configured. Add it in Settings -> AI Providers." },
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
