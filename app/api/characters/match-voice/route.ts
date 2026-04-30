import { NextResponse } from "next/server";
import { z } from "zod";
import { getProviderKey } from "@/lib/provider-keys";

const RequestSchema = z.object({
  elevenLabsSearchTerms: z.string().min(1),
  gender: z.enum(["man", "woman"]),
  pitch: z.string().optional().default(""),
  pace: z.string().optional().default(""),
  accent: z.string().optional().default(""),
});

type ElevenVoice = {
  voice_id: string;
  name: string;
  preview_url?: string | null;
  category?: string;
  labels?: Record<string, string>;
};

function normalize(value: string | undefined | null) {
  return (value ?? "").toLowerCase();
}

function scoreVoice(voice: ElevenVoice, input: z.infer<typeof RequestSchema>) {
  const terms = input.elevenLabsSearchTerms.toLowerCase().split(/\s+/).filter(Boolean);
  const labelText = Object.values(voice.labels ?? {}).join(" ").toLowerCase();
  const haystack = `${voice.name} ${labelText}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (normalize(voice.name).includes(term)) score += 3;
    if (labelText.includes(term)) score += 2;
  }

  if (voice.category === "premade") score += 2;

  const wantedGender = input.gender === "man" ? "male" : "female";
  if (labelText.includes(wantedGender) || labelText.includes(input.gender)) score += 2;
  if (input.accent && labelText.includes(input.accent.toLowerCase())) score += 2;
  if (input.pitch && haystack.includes(input.pitch.toLowerCase())) score += 1;
  if (input.pace && haystack.includes(input.pace.toLowerCase())) score += 1;

  return score;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const apiKey = await getProviderKey("elevenlabs");
  if (!apiKey) {
    return NextResponse.json(
      {
        data: {
          voices: [],
          missingKey: true,
          message: "Connect ElevenLabs in Settings to get voice suggestions. You can assign a voice later from the character profile.",
        },
        error: null,
      }
    );
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    return NextResponse.json({ data: null, error: "Could not fetch ElevenLabs voices" }, { status: 502 });
  }

  const json = (await res.json()) as { voices?: ElevenVoice[] };
  const wantedGender = parsed.data.gender === "man" ? "male" : "female";
  const voices = (json.voices ?? [])
    .filter((voice) => {
      const labels = Object.values(voice.labels ?? {}).join(" ").toLowerCase();
      return !labels.includes("gender") || labels.includes(wantedGender) || labels.includes(parsed.data.gender) || labels.length > 0;
    })
    .map((voice) => ({ ...voice, score: scoreVoice(voice, parsed.data) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((voice) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      preview_url: voice.preview_url ?? null,
      labels: voice.labels ?? {},
      score: voice.score,
    }));

  return NextResponse.json({ data: { voices, missingKey: false }, error: null });
}
