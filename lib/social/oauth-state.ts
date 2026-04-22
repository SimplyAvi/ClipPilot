/**
 * lib/social/oauth-state.ts
 *
 * CSRF-safe state parameter for OAuth flows.
 * Signs {platform}:{timestamp} with ENCRYPTION_SECRET via HMAC-SHA256.
 * State expires after 10 minutes.
 */

import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.ENCRYPTION_SECRET ?? "dev-secret-placeholder";
}

export function createOAuthState(platform: string): string {
  const ts = Date.now().toString();
  const sig = createHmac("sha256", getSecret())
    .update(`${platform}:${ts}`)
    .digest("hex")
    .slice(0, 24);
  return Buffer.from(`${platform}:${ts}:${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string, expectedPlatform: string): boolean {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [platform, ts, sig] = parts;
    if (platform !== expectedPlatform) return false;
    const age = Date.now() - parseInt(ts, 10);
    if (age < 0 || age > 10 * 60 * 1000) return false; // expired
    const expected = createHmac("sha256", getSecret())
      .update(`${platform}:${ts}`)
      .digest("hex")
      .slice(0, 24);
    return sig === expected;
  } catch {
    return false;
  }
}
