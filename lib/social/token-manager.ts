/**
 * lib/social/token-manager.ts
 *
 * Retrieves and auto-refreshes OAuth access tokens for all social platforms.
 * Tokens are stored encrypted in SocialAccount and decrypted on demand.
 */

import { db } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if within 5 minutes of expiry

// ─── Platform-specific refresh logic ─────────────────────────────────────────

async function refreshYouTubeToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube token refresh failed: ${text}`);
  }
  return res.json();
}

async function refreshTikTokToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok token refresh failed: ${text}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

async function refreshInstagramToken(accessToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram token refresh failed: ${text}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given platform.
 * Automatically refreshes if expired or within 5 minutes of expiry.
 * Throws if the account is not connected or refresh fails.
 */
export async function getValidToken(platform: string): Promise<string> {
  const account = await db.socialAccount.findUnique({ where: { platform } });
  if (!account || !account.isConnected) {
    throw new Error(
      `Connect your ${capitalize(platform)} account in Settings → Connected Accounts first`
    );
  }

  const accessToken = decryptApiKey(account.encryptedAccessToken);
  const now = new Date();
  const expiry = account.tokenExpiresAt;

  // Token is still valid — return early
  if (expiry && expiry.getTime() - now.getTime() > REFRESH_BUFFER_MS) {
    return accessToken;
  }

  // Need to refresh
  const refreshToken = account.encryptedRefreshToken
    ? decryptApiKey(account.encryptedRefreshToken)
    : null;

  let newAccessToken: string;
  let newExpiry: Date;
  let newEncryptedRefresh: string | undefined;

  try {
    if (platform === "youtube") {
      if (!refreshToken) throw new Error("No refresh token stored for YouTube");
      const data = await refreshYouTubeToken(refreshToken);
      newAccessToken = data.access_token;
      newExpiry = new Date(Date.now() + data.expires_in * 1000);
    } else if (platform === "tiktok") {
      if (!refreshToken) throw new Error("No refresh token stored for TikTok");
      const data = await refreshTikTokToken(refreshToken);
      newAccessToken = data.access_token;
      newExpiry = new Date(Date.now() + data.expires_in * 1000);
      // TikTok also rotates the refresh token
      newEncryptedRefresh = encryptApiKey(data.refresh_token);
    } else if (platform === "instagram") {
      // Instagram uses long-lived tokens that refresh by passing the current token
      const data = await refreshInstagramToken(accessToken);
      newAccessToken = data.access_token;
      newExpiry = new Date(Date.now() + data.expires_in * 1000);
    } else {
      throw new Error(`Unknown platform: ${platform}`);
    }
  } catch (err) {
    throw new Error(
      `Your ${capitalize(platform)} connection has expired. Reconnect in Settings. (${(err as Error).message})`
    );
  }

  // Persist refreshed token
  await db.socialAccount.update({
    where: { platform },
    data: {
      encryptedAccessToken: encryptApiKey(newAccessToken),
      tokenExpiresAt: newExpiry,
      ...(newEncryptedRefresh ? { encryptedRefreshToken: newEncryptedRefresh } : {}),
    },
  });

  return newAccessToken;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
