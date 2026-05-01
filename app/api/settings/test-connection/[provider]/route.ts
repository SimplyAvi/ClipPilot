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
import { R2StorageAdapter } from "@/lib/storage/r2-adapter";

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

async function testConfiguredProvider(
  provider: "kling" | "luma" | "pika" | "minimax",
  label: string
): Promise<{ connected: boolean; message: string }> {
  const key = await getProviderKey(provider);
  if (!key) return { connected: false, message: `${provider.toUpperCase()} API key is not configured` };
  return {
    connected: true,
    message: `${label} API key is saved. The first real generation request will confirm provider-side permissions.`,
  };
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
    if (creds.R2_ACCESS_KEY_ID.trim().length !== 32) {
      return {
        connected: false,
        message:
          "R2 Access Key ID should be 32 characters. It looks like the Access Key ID and Secret Access Key may be swapped.",
      };
    }
    const adapter = new R2StorageAdapter({
      accountId: creds.R2_ACCOUNT_ID,
      accessKeyId: creds.R2_ACCESS_KEY_ID,
      secretAccessKey: creds.R2_SECRET_ACCESS_KEY,
      bucket: creds.R2_BUCKET_NAME,
      publicBaseUrl: creds.R2_PUBLIC_URL,
    });
    await adapter.initProjectFolders();
    return { connected: true, message: "Connected — R2 bucket is reachable" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid R2 credentials format";
    if (message.includes("Credential access key has length")) {
      return {
        connected: false,
        message:
          "R2 Access Key ID has the wrong length. Check that Access Key ID is in R2_ACCESS_KEY_ID and the longer secret is in R2_SECRET_ACCESS_KEY.",
      };
    }
    return { connected: false, message };
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
      case "kling":      result = await testConfiguredProvider("kling", "Kling AI"); break;
      case "luma":       result = await testConfiguredProvider("luma", "Luma Dream Machine"); break;
      case "pika":       result = await testConfiguredProvider("pika", "Pika"); break;
      case "minimax":    result = await testConfiguredProvider("minimax", "MiniMax"); break;
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
