/**
 * GET /api/auth/callback/youtube
 *
 * Exchanges the Google OAuth code for access + refresh tokens,
 * fetches channel info, encrypts and saves to SocialAccount,
 * then redirects to /settings?connected=youtube.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/social/oauth-state";
import { encryptApiKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getYouTubeChannelInfo } from "@/lib/social/youtube-uploader";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state || !verifyOAuthState(state, "youtube")) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=invalid_state`
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: `${APP_URL}/api/auth/callback/youtube`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Fetch channel info
    const { channelId, title } = await getYouTubeChannelInfo(access_token);

    // Upsert SocialAccount
    await db.socialAccount.upsert({
      where: { platform: "youtube" },
      update: {
        username: title,
        platformUserId: channelId,
        encryptedAccessToken: encryptApiKey(access_token),
        encryptedRefreshToken: refresh_token ? encryptApiKey(refresh_token) : undefined,
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 3600) * 1000),
        isConnected: true,
      },
      create: {
        platform: "youtube",
        username: title,
        platformUserId: channelId,
        encryptedAccessToken: encryptApiKey(access_token),
        encryptedRefreshToken: refresh_token ? encryptApiKey(refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 3600) * 1000),
        isConnected: true,
      },
    });

    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&connected=youtube`
    );
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(msg)}`
    );
  }
}
