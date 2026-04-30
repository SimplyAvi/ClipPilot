/**
 * GET /api/settings/test-connection/[provider]
 *
 * Makes a minimal authenticated request to the named provider and
 * returns { connected: boolean, message: string }.
 * API keys are read from the encrypted ProviderKey table via getProviderKey().
 * On success, marks the provider as verified (isVerified=true, lastTestedAt=now).
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getProviderKey, markProviderKeyVerified } from "@/lib/provider-keys";
import { testMubertCredentials } from "@/lib/music/mubert-client";

async function testAnthropic(): Promise<{ connected: boolean; message: string }> {
  const apiKey = await getProviderKey("anthropic");
  if (!apiKey) return { connected: false, message: "ANTHROPIC_API_KEY is not configured" };
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return { connected: true, message: "Anthropic Claude is reachable" };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testElevenLabs(): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey("elevenlabs");
  if (!key) return { connected: false, message: "ELEVENLABS_API_KEY is not configured" };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}: ${res.statusText}` };
    const json = await res.json();
    const count: number = Array.isArray(json.voices) ? json.voices.length : 0;
    return { connected: true, message: `Connected — ${count} voice(s) available` };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testRunway(): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey("runway");
  if (!key) return { connected: false, message: "RUNWAYML_API_SECRET is not configured" };
  try {
    const res = await fetch("https://api.dev.runwayml.com/v1/organization", {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    if (res.status === 401) return { connected: false, message: "Invalid API key" };
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}: ${res.statusText}` };
    return { connected: true, message: "Runway ML is reachable" };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testReplicate(): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey("replicate");
  if (!key) return { connected: false, message: "REPLICATE_API_TOKEN is not configured" };
  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Token ${key}` },
    });
    if (res.status === 401) return { connected: false, message: "Invalid API token" };
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}: ${res.statusText}` };
    const json = await res.json();
    return { connected: true, message: `Connected — account: ${json.username ?? "unknown"}` };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testAudd(): Promise<{ connected: boolean; message: string }> {
  const token = await getProviderKey("audd");
  if (!token) return { connected: false, message: "AUDD_API_TOKEN is not configured" };
  try {
    const body = new URLSearchParams({ api_token: token, return: "apple_music,spotify" });
    const res = await fetch("https://api.audd.io/", { method: "POST", body });
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}: ${res.statusText}` };
    const json = await res.json();
    if (json.status === "error" && json.error?.error_code === 901) {
      return { connected: false, message: "Invalid AudD API token" };
    }
    return { connected: true, message: "AudD is reachable and authenticated" };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testSyncLabs(): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey("synclabs");
  if (!key) return { connected: false, message: "SYNCLABS_API_KEY is not configured" };
  try {
    const res = await fetch("https://api.sync.so/v2/lipsync", {
      method: "GET",
      headers: { "x-api-key": key },
    });
    if (res.status === 401) return { connected: false, message: "Invalid Sync Labs API key" };
    return { connected: true, message: "Sync Labs is reachable" };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testR2(): Promise<{ connected: boolean; message: string }> {
  const raw = await getProviderKey("r2");
  if (!raw) return { connected: false, message: "R2 credentials are not configured" };
  try {
    const creds = JSON.parse(raw) as Record<string, string>;
    const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
    const missing = required.filter((k) => !creds[k]?.trim());
    if (missing.length > 0) {
      return { connected: false, message: `Missing: ${missing.join(", ")}` };
    }
    return { connected: true, message: "All R2 credentials are configured" };
  } catch {
    return { connected: false, message: "Invalid R2 credentials format" };
  }
}

async function testMubert(): Promise<{ connected: boolean; message: string }> {
  try {
    const result = await testMubertCredentials();
    return { connected: result.ok, message: result.message };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function testOpenAI(): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey("openai");
  if (!key) return { connected: false, message: "OPENAI_API_KEY is not configured" };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) return { connected: false, message: "Invalid OpenAI API key" };
    if (!res.ok) return { connected: false, message: `HTTP ${res.status}: ${res.statusText}` };
    return { connected: true, message: "OpenAI is reachable — Whisper transcription enabled" };
  } catch (err) {
    return { connected: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  try {
    let result: { connected: boolean; message: string };

    switch (provider) {
      case "anthropic":  result = await testAnthropic(); break;
      case "elevenlabs": result = await testElevenLabs(); break;
      case "runway":     result = await testRunway(); break;
      case "replicate":  result = await testReplicate(); break;
      case "audd":       result = await testAudd(); break;
      case "synclabs":   result = await testSyncLabs(); break;
      case "r2":         result = await testR2(); break;
      case "mubert":     result = await testMubert(); break;
      case "openai":     result = await testOpenAI(); break;
      default:
        return NextResponse.json(
          { connected: false, message: "Unknown provider" },
          { status: 400 }
        );
    }

    // Mark as verified in the DB if the test passed
    if (result.connected) {
      await markProviderKeyVerified(provider);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ connected: false, message });
  }
}
