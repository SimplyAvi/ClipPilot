/**
 * GET /api/auth/callback/tiktok
 *
 * Exchanges the TikTok OAuth code for access + refresh tokens,
 * fetches user info, encrypts and saves to SocialAccount,
 * then redirects to /settings?connected=tiktok.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/social/oauth-state";
import { encryptApiKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getTikTokUserInfo } from "@/lib/social/tiktok-uploader";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(errorDescription ?? error)}`
    );
  }

  if (!code || !state || !verifyOAuthState(state, "tiktok")) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=invalid_state`
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        redirect_uri: `${APP_URL}/api/auth/callback/tiktok`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`TikTok token exchange failed: ${text}`);
    }

    const tokenJson = await tokenRes.json();
    const tokenData = tokenJson.data ?? tokenJson;
    const {
      access_token,
      refresh_token,
      expires_in,
      refresh_expires_in,
    } = tokenData;

    // Fetch user info
    const { openId, displayName } = await getTikTokUserInfo(access_token);

    // Upsert SocialAccount
    await db.socialAccount.upsert({
      where: { platform: "tiktok" },
      update: {
        username: displayName,
        platformUserId: openId,
        encryptedAccessToken: encryptApiKey(access_token),
        encryptedRefreshToken: refresh_token ? encryptApiKey(refresh_token) : undefined,
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 86400) * 1000),
        isConnected: true,
      },
      create: {
        platform: "tiktok",
        username: displayName,
        platformUserId: openId,
        encryptedAccessToken: encryptApiKey(access_token),
        encryptedRefreshToken: refresh_token ? encryptApiKey(refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 86400) * 1000),
        isConnected: true,
      },
    });

    void refresh_expires_in; // acknowledged but not stored separately

    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&connected=tiktok`
    );
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(msg)}`
    );
  }
}
