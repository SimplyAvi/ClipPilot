/**
 * app-settings.ts
 *
 * Runtime key-value store backed by the AppSetting DB table.
 * Priority order for getSetting():
 *   1. AppSetting table (legacy plain-text)
 *   2. ProviderKey table (new encrypted storage)
 *   3. process.env fallback
 *
 * All functions are graceful — if the DB is unreachable they fall back silently.
 */

import { db } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { ENV_VAR_TO_PROVIDER, PROVIDER_ENV_MAP } from "@/lib/provider-keys";

/**
 * Fetch a setting value by env-var-style key (e.g. "ANTHROPIC_API_KEY").
 * Checks AppSetting table, then ProviderKey table (decrypted), then process.env.
 */
export async function getSetting(key: string): Promise<string | null> {
  // 1. Legacy AppSetting table
  try {
    const row = await db.appSetting.findUnique({ where: { key } });
    if (row?.value?.trim()) return row.value.trim();
  } catch {
    // DB unavailable
  }

  // 2. ProviderKey table (encrypted) — look up via env var → provider mapping
  const provider = ENV_VAR_TO_PROVIDER[key];
  if (provider) {
    try {
      const row = await db.providerKey.findUnique({ where: { provider } });
      if (row?.encryptedKey) {
        const decrypted = decryptApiKey(row.encryptedKey);
        const envVars = PROVIDER_ENV_MAP[provider];
        // For single-key providers, return the decrypted value directly
        if (!Array.isArray(envVars)) return decrypted;
        // For multi-key providers (e.g. R2), the value is a JSON object
        try {
          const obj = JSON.parse(decrypted) as Record<string, string>;
          return obj[key]?.trim() || null;
        } catch {
          return null;
        }
      }
    } catch {
      // Decryption failed or DB unavailable
    }
  }

  // 3. Environment variable fallback
  const envVal = process.env[key];
  return envVal?.trim() || null;
}

/**
 * Persist a setting value to the AppSetting table (legacy path).
 * Passing an empty string removes the stored value.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    await db.appSetting.deleteMany({ where: { key } });
    return;
  }
  await db.appSetting.upsert({
    where: { key },
    update: { value: trimmed },
    create: { key, value: trimmed },
  });
}

/**
 * Return a map of key → isSet for a list of env-var-style setting keys.
 * Checks AppSetting table, ProviderKey table, and process.env.
 * Used by the settings page to show status badges.
 */
export async function getSettingsStatus(
  keys: readonly string[]
): Promise<Record<string, boolean>> {
  let dbRows: Array<{ key: string; value: string }> = [];
  let providerRows: Array<{ provider: string }> = [];

  try {
    [dbRows, providerRows] = await Promise.all([
      db.appSetting.findMany({
        where: { key: { in: keys as string[] } },
        select: { key: true, value: true },
      }),
      db.providerKey.findMany({ select: { provider: true } }),
    ]);
  } catch {
    // DB unavailable
  }

  const dbMap = new Map(dbRows.map((r) => [r.key, r.value.trim().length > 0]));
  const dbProviders = new Set(providerRows.map((r) => r.provider));

  return Object.fromEntries(
    keys.map((k) => {
      // Check legacy AppSetting
      if (dbMap.get(k)) return [k, true];
      // Check ProviderKey table via env var → provider mapping
      const provider = ENV_VAR_TO_PROVIDER[k];
      if (provider && dbProviders.has(provider)) return [k, true];
      // Env var fallback
      return [k, Boolean(process.env[k]?.trim())];
    })
  );
}
