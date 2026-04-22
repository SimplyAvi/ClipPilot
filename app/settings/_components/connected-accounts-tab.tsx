"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Unplug,
  Link as LinkIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SocialAccountStatus {
  platform: string;
  username: string | null;
  platformUserId: string | null;
  tokenExpiresAt: string | null;
  isConnected: boolean;
  updatedAt: string;
}

// ─── Platform config ────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "youtube",
    name: "YouTube",
    initial: "YT",
    color: "bg-red-600",
    description: "Upload videos and Shorts directly to your YouTube channel.",
    setupSteps: [
      "Go to console.cloud.google.com",
      "Create a project and enable YouTube Data API v3",
      'Create OAuth 2.0 credentials under "APIs & Services → Credentials"',
      `Set Authorized redirect URI to: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/auth/callback/youtube`,
      "Copy GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET into your .env file",
    ],
    docsUrl: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
  },
  {
    id: "tiktok",
    name: "TikTok",
    initial: "TT",
    color: "bg-black",
    description: "Publish videos directly to TikTok using the Content Posting API.",
    setupSteps: [
      "Go to developers.tiktok.com and sign in",
      'Click "Manage Apps" then "Create App"',
      "Add product: Login Kit and Content Posting API",
      `Set redirect URI to: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/auth/callback/tiktok`,
      "Copy TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET into your .env file",
    ],
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },
  {
    id: "instagram",
    name: "Instagram",
    initial: "IG",
    color: "bg-gradient-to-br from-purple-600 to-pink-500",
    description: "Post Reels to Instagram via the Instagram Graph API.",
    setupSteps: [
      "Go to developers.facebook.com and create a Meta App",
      "Add the Instagram product to your app",
      "Connect your Instagram Business or Creator account",
      `Set redirect URI to: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/auth/callback/instagram`,
      "Copy INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET into your .env file",
    ],
    docsUrl: "https://developers.facebook.com/docs/instagram-api/guides/content-publishing",
  },
];

// ─── Account card ────────────────────────────────────────────────────────────

function AccountCard({
  platform,
  account,
  onConnect,
  onDisconnect,
  isLoading,
  successPlatform,
  errorMessage,
}: {
  platform: typeof PLATFORMS[number];
  account: SocialAccountStatus | null;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  isLoading: string | null;
  successPlatform: string | null;
  errorMessage: string | null;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const isConnected = account?.isConnected ?? false;
  const isThisLoading = isLoading === platform.id;
  const isThisSuccess = successPlatform === platform.id;
  const isThisError = errorMessage && isLoading === null;

  const expiry = account?.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const isExpired = expiry ? expiry < new Date() : false;

  return (
    <Card className={isThisSuccess ? "border-green-400" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {/* Platform avatar */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${platform.color}`}
          >
            {platform.initial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{platform.name}</span>
              {isConnected && !isExpired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
              ) : isConnected && isExpired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Token expired
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Not connected
                </span>
              )}
            </div>
            {isConnected && account?.username && (
              <p className="text-xs text-muted-foreground mt-0.5">
                @{account.username}
                {expiry && !isExpired && (
                  <span className="ml-2">
                    · Token expires {expiry.toLocaleDateString()}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action button */}
          {isConnected && !isExpired ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDisconnect(platform.id)}
              disabled={isThisLoading}
            >
              {isThisLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">Disconnect</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect(platform.id)}
              disabled={isThisLoading}
            >
              {isThisLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LinkIcon className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">
                {isConnected && isExpired ? "Reconnect" : "Connect"}
              </span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-muted-foreground">{platform.description}</p>

        {/* Success toast */}
        {isThisSuccess && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Successfully connected to {platform.name}!
          </p>
        )}

        {/* Error message */}
        {isThisError && errorMessage && (
          <p className="text-sm text-destructive flex items-start gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {errorMessage}
          </p>
        )}

        {/* Setup instructions */}
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowSetup((v) => !v)}
        >
          {showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          How to set this up
        </button>

        {showSetup && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <ol className="list-decimal list-inside space-y-1">
              {platform.setupSteps.map((step, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {step}
                </li>
              ))}
            </ol>
            <a
              href={platform.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
            >
              <ExternalLink className="h-3 w-3" />
              Official documentation
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export function ConnectedAccountsTab() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successPlatform, setSuccessPlatform] = useState<string | null>(null);
  const [errorPlatform, setErrorPlatform] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/social/accounts");
      const json = await res.json();
      if (res.ok) setAccounts(json.data ?? []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAccounts();
    // Show success / error from OAuth callback redirect
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setSuccessPlatform(connected);
      setTimeout(() => setSuccessPlatform(null), 5000);
    }
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      setTimeout(() => setErrorMessage(null), 8000);
    }
  }, [fetchAccounts, searchParams]);

  function handleConnect(platformId: string) {
    // Redirect to OAuth initiation route
    window.location.href = `/api/auth/${platformId}`;
  }

  async function handleDisconnect(platformId: string) {
    setActionLoading(platformId);
    try {
      const res = await fetch(`/api/social/accounts/${platformId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.platform === platformId ? { ...a, isConnected: false } : a
          )
        );
      }
    } catch { /* non-fatal */ }
    finally { setActionLoading(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading connected accounts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your social media accounts to publish videos directly from ClipPilot.
        </p>
      </div>

      {PLATFORMS.map((platform) => {
        const account = accounts.find((a) => a.platform === platform.id) ?? null;
        return (
          <AccountCard
            key={platform.id}
            platform={platform}
            account={account}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            isLoading={actionLoading}
            successPlatform={successPlatform}
            errorMessage={errorMessage && errorPlatform === platform.id ? errorMessage : null}
          />
        );
      })}

      {/* Global error (when platform not clear) */}
      {errorMessage && !errorPlatform && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}
