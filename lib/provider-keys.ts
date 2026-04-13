/**
 * lib/provider-keys.ts
 *
 * Encrypted provider API key storage backed by the ProviderKey DB table.
 * Keys are encrypted at rest using AES-256-GCM (see lib/crypto.ts).
 *
 * For providers with a single key, the plaintext is the API key string.
 * For R2 (4 separate keys), the plaintext is a JSON object:
 *   { R2_ACCOUNT_ID: "...", R2_ACCESS_KEY_ID: "...", ... }
 */

import { db } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

// ─── Provider → env var mapping ───────────────────────────────────────────────

// For multi-key providers (R2) the value is an array of env var names;
// the key is stored/returned as a JSON object keyed by those names.
export const PROVIDER_ENV_MAP: Record<string, string | string[]> = {
  anthropic: "ANTHROPIC_API_KEY",
  runway: "RUNWAYML_API_SECRET",
  replicate: "REPLICATE_API_TOKEN",
  elevenlabs: "ELEVENLABS_API_KEY",
  mubert: "MUBERT_API_KEY",
  audd: "AUDD_API_TOKEN",
  synclabs: "SYNCLABS_API_KEY",
  openai: "OPENAI_API_KEY",
  r2: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"],
};

export const PROVIDER_NAMES = Object.keys(PROVIDER_ENV_MAP);

// Reverse map: env var name → provider name (used by getSetting fallback)
export const ENV_VAR_TO_PROVIDER: Record<string, string> = {};
for (const [provider, envVar] of Object.entries(PROVIDER_ENV_MAP)) {
  if (Array.isArray(envVar)) {
    for (const key of envVar) ENV_VAR_TO_PROVIDER[key] = provider;
  } else {
    ENV_VAR_TO_PROVIDER[envVar] = provider;
  }
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Encrypts and persists a provider key.
 * For R2, pass a JSON string: JSON.stringify({ R2_ACCOUNT_ID: "...", ... }).
 * Sets isVerified = false so the key must be re-tested after saving.
 */
export async function saveProviderKey(
  provider: string,
  plainKey: string
): Promise<void> {
  const encrypted = encryptApiKey(plainKey);
  await db.providerKey.upsert({
    where: { provider },
    update: { encryptedKey: encrypted, isVerified: false },
    create: { provider, encryptedKey: encrypted },
  });
}

/**
 * Retrieves and decrypts a provider key.
 * Falls back to environment variables if no DB record exists.
 * Returns null if the key is not configured.
 */
export async function getProviderKey(provider: string): Promise<string | null> {
  // 1. Check ProviderKey table
  try {
    const row = await db.providerKey.findUnique({ where: { provider } });
    if (row?.encryptedKey) {
      return decryptApiKey(row.encryptedKey);
    }
  } catch {
    // DB unavailable or decryption failed — fall through to env var
  }

  // 2. Env var fallback
  const envVar = PROVIDER_ENV_MAP[provider];
  if (!envVar) return null;

  if (Array.isArray(envVar)) {
    const hasAll = envVar.every((k) => Boolean(process.env[k]?.trim()));
    if (!hasAll) return null;
    return JSON.stringify(
      Object.fromEntries(envVar.map((k) => [k, process.env[k] ?? ""]))
    );
  }

  return process.env[envVar]?.trim() || null;
}

/**
 * Marks a provider key as verified (called after a successful connection test).
 */
export async function markProviderKeyVerified(provider: string): Promise<void> {
  try {
    await db.providerKey.updateMany({
      where: { provider },
      data: { isVerified: true, lastTestedAt: new Date() },
    });
  } catch {
    // Not critical — ignore
  }
}

/**
 * Returns configured/missing status for all known providers.
 * Checks DB first, then falls back to env vars.
 */
export async function getAllProviderStatus(): Promise<
  Record<string, { configured: boolean; isVerified: boolean; lastTestedAt: string | null }>
> {
  let rows: Array<{
    provider: string;
    isVerified: boolean;
    lastTestedAt: Date | null;
  }> = [];

  try {
    rows = await db.providerKey.findMany({
      select: { provider: true, isVerified: true, lastTestedAt: true },
    });
  } catch {
    // DB unavailable
  }

  const dbMap = new Map(rows.map((r) => [r.provider, r]));

  return Object.fromEntries(
    PROVIDER_NAMES.map((provider) => {
      const dbRow = dbMap.get(provider);
      if (dbRow) {
        return [
          provider,
          {
            configured: true,
            isVerified: dbRow.isVerified,
            lastTestedAt: dbRow.lastTestedAt?.toISOString() ?? null,
          },
        ];
      }
      // Env var fallback check
      const envVar = PROVIDER_ENV_MAP[provider];
      const isSet = Array.isArray(envVar)
        ? envVar.every((k) => Boolean(process.env[k]?.trim()))
        : Boolean(process.env[envVar as string]?.trim());
      return [
        provider,
        { configured: isSet, isVerified: false, lastTestedAt: null },
      ];
    })
  );
}
