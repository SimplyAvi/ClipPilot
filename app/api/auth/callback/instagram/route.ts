/**
 * GET /api/auth/callback/instagram
 *
 * Exchanges the Instagram OAuth code for a short-lived token,
 * exchanges that for a long-lived token (60-day expiry),
 * fetches user info, encrypts and saves to SocialAccount,
 * then redirects to /settings?connected=instagram.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/social/oauth-state";
import { encryptApiKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getInstagramUserInfo } from "@/lib/social/instagram-uploader";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const GRAPH_API = "https://graph.instagram.com";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(errorReason ?? error)}`
    );
  }

  if (!code || !state || !verifyOAuthState(state, "instagram")) {
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=invalid_state`
    );
  }

  try {
    // Step 1: Exchange code for short-lived token
    const shortTokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        app_id: process.env.INSTAGRAM_APP_ID ?? "",
        app_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
        grant_type: "authorization_code",
        redirect_uri: `${APP_URL}/api/auth/callback/instagram`,
        code: code.replace("#_", ""), // Instagram sometimes appends #_ to code
      }),
    });

    if (!shortTokenRes.ok) {
      const text = await shortTokenRes.text();
      throw new Error(`Instagram short token exchange failed: ${text}`);
    }

    const shortTokenData = await shortTokenRes.json();
    const shortAccessToken: string = shortTokenData.access_token;

    // Step 2: Exchange for long-lived token (60-day expiry)
    const longTokenUrl = new URL(`${GRAPH_API}/access_token`);
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set(
      "client_secret",
      process.env.INSTAGRAM_APP_SECRET ?? ""
    );
    longTokenUrl.searchParams.set("access_token", shortAccessToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    if (!longTokenRes.ok) {
      const text = await longTokenRes.text();
      throw new Error(`Instagram long-lived token exchange failed: ${text}`);
    }

    const longTokenData = await longTokenRes.json();
    const { access_token: longAccessToken, expires_in } = longTokenData;

    // Step 3: Fetch user info (ig_user_id, username)
    const { igUserId, username } = await getInstagramUserInfo(longAccessToken);

    // Step 4: Upsert SocialAccount
    await db.socialAccount.upsert({
      where: { platform: "instagram" },
      update: {
        username,
        platformUserId: igUserId,
        encryptedAccessToken: encryptApiKey(longAccessToken),
        encryptedRefreshToken: null, // Instagram uses token rotation, not refresh tokens
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 5183944) * 1000),
        isConnected: true,
      },
      create: {
        platform: "instagram",
        username,
        platformUserId: igUserId,
        encryptedAccessToken: encryptApiKey(longAccessToken),
        encryptedRefreshToken: null,
        tokenExpiresAt: new Date(Date.now() + (expires_in ?? 5183944) * 1000),
        isConnected: true,
      },
    });

    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&connected=instagram`
    );
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.redirect(
      `${APP_URL}/settings?tab=connected-accounts&error=${encodeURIComponent(msg)}`
    );
  }
}
