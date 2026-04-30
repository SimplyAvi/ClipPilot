/**
 * ElevenLabs API client with basic rate limiting.
 *
 * Rate limit: ElevenLabs Creator plan allows ~2 concurrent requests.
 * We enforce a minimum gap of 500 ms between calls to avoid 429s.
 */

import { getProviderKey } from "@/lib/provider-keys";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const MIN_REQUEST_GAP_MS = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string; // "premade" | "cloned" | "generated"
  labels: Record<string, string>;
  preview_url: string | null;
}

export interface VoiceSettings {
  stability: number;       // 0–1: higher = more stable/consistent
  similarity_boost: number; // 0–1: higher = closer to original voice
  style: number;            // 0–1: style exaggeration
  use_speaker_boost: boolean;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let lastCallAt = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
  }
  lastCallAt = Date.now();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
  const key = await getProviderKey("elevenlabs");
  if (!key || key === "...") {
    throw new Error("ElevenLabs API key is not configured. Add it in Settings -> AI Providers.");
  }
  return key;
}

async function headers(extra?: Record<string, string>) {
  return {
    "xi-api-key": await getApiKey(),
    "Content-Type": "application/json",
    ...extra,
  };
}

// ─── Voice settings by pace + emotional range ─────────────────────────────────

export function buildVoiceSettings(
  pace: "slow" | "normal" | "fast",
  emotionalRange: "restrained" | "moderate" | "expressive"
): VoiceSettings {
  // Stability: lower = more expressive/variable
  const stabilityByRange = { restrained: 0.85, moderate: 0.60, expressive: 0.35 };
  // Style: higher = more style exaggeration
  const styleByRange = { restrained: 0.1, moderate: 0.35, expressive: 0.65 };
  // Pace maps to speed (ElevenLabs doesn't have a direct pace param,
  // but we encode it in the prompt prefix passed to TTS)

  return {
    stability: stabilityByRange[emotionalRange],
    similarity_boost: 0.75,
    style: styleByRange[emotionalRange],
    use_speaker_boost: true,
  };
}

/** Wraps text with pace instructions ElevenLabs responds to. */
export function applyPaceToText(text: string, pace: "slow" | "normal" | "fast"): string {
  if (pace === "slow") return `<break time="0.3s"/>${text}`;
  if (pace === "fast") return text.replace(/\. /g, ". ");
  return text;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetch all available voices from the ElevenLabs account.
 * Returns premade + any custom voices on the account.
 */
export async function getVoices(): Promise<ElevenLabsVoice[]> {
  await waitForRateLimit();

  const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: await headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs voices error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { voices: ElevenLabsVoice[] };
  return data.voices;
}

/**
 * Generate TTS audio for the given text using the specified voice.
 * Returns raw audio bytes (audio/mpeg).
 */
export async function textToSpeech(
  voiceId: string,
  text: string,
  settings: VoiceSettings
): Promise<ArrayBuffer> {
  await waitForRateLimit();

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: settings,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
  }

  return res.arrayBuffer();
}

/**
 * Convenience: generate a short voice preview clip.
 * Uses a fixed test sentence so the preview is always ~5 seconds.
 */
export async function generateVoicePreview(
  voiceId: string,
  customText: string | null,
  pace: "slow" | "normal" | "fast",
  emotionalRange: "restrained" | "moderate" | "expressive"
): Promise<ArrayBuffer> {
  const DEFAULT_LINE =
    "Hello. I am your character. This is how I will sound throughout the video.";

  const rawText = customText?.trim() || DEFAULT_LINE;
  const text = applyPaceToText(rawText, pace);
  const settings = buildVoiceSettings(pace, emotionalRange);

  return textToSpeech(voiceId, text, settings);
}
