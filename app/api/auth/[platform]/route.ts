/**
 * GET /api/auth/[platform]
 *
 * Initiates the OAuth flow for a given social platform.
 * Redirects the user to the platform's consent screen.
 *
 * Supported platforms: youtube | tiktok | instagram
 */

import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/social/oauth-state";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(
  _req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const { platform } = params;
  const state = createOAuthState(platform);
  const redirectUri = `${APP_URL}/api/auth/callback/${platform}`;

  switch (platform) {
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: "GOOGLE_CLIENT_ID is not configured" },
          { status: 500 }
        );
      }
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
      );
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent"); // force refresh_token
      url.searchParams.set("state", state);
      return NextResponse.redirect(url.toString());
    }

    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) {
        return NextResponse.json(
          { error: "TIKTOK_CLIENT_KEY is not configured" },
          { status: 500 }
        );
      }
      const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
      url.searchParams.set("client_key", clientKey);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        "video.upload,video.publish,user.info.basic"
      );
      url.searchParams.set("state", state);
      return NextResponse.redirect(url.toString());
    }

    case "instagram": {
      const appId = process.env.INSTAGRAM_APP_ID;
      if (!appId) {
        return NextResponse.json(
          { error: "INSTAGRAM_APP_ID is not configured" },
          { status: 500 }
        );
      }
      // Instagram uses Facebook's OAuth dialog for Graph API access
      const url = new URL("https://api.instagram.com/oauth/authorize");
      url.searchParams.set("app_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        "instagram_basic,instagram_content_publish"
      );
      url.searchParams.set("state", state);
      return NextResponse.redirect(url.toString());
    }

    default:
      return NextResponse.json(
        { error: `Unknown platform: ${platform}` },
        { status: 400 }
      );
  }
}
