/**
 * env-status.ts — Server-side utility for checking configured env vars.
 * Do NOT import this in client components (process.env is server-only).
 * Pass the result as a serialisable prop to client components instead.
 */

export const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "RUNWAYML_API_SECRET",
  "REPLICATE_API_TOKEN",
  "ELEVENLABS_API_KEY",
  "MUBERT_API_KEY",
  "AUDD_API_TOKEN",
  "SYNCLABS_API_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "USE_LOCAL_STORAGE",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];
export type EnvStatus = Record<EnvKey, boolean>;

function isSet(key: string): boolean {
  const val = process.env[key];
  return typeof val === "string" && val.trim().length > 0;
}

/** Returns a plain object indicating which env vars are set (non-empty). */
export function getEnvStatus(): EnvStatus {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, isSet(k)])) as EnvStatus;
}

/**
 * Warn to console if a required key is missing.
 * Call this before using a provider in the pipeline.
 */
export function requireEnv(key: EnvKey, context: string): string {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    console.warn(`[env-status] ${key} is not set — ${context} will fail.`);
    return "";
  }
  return val;
}
