"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  KeyRound,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderStatus {
  configured: boolean;
  isVerified: boolean;
  lastTestedAt: string | null;
}

type AllProviderStatus = Record<string, ProviderStatus>;

// ─── Provider definitions ──────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  initial: string;
  color: string;
  description: string;
  // For single-key providers: one entry. For R2: four entries.
  envVars: string[];
  manual?: true;
  manualNote?: string;
  getKeyHref?: string;
}

interface Section {
  title: string;
  providers: Provider[];
}

const SECTIONS: Section[] = [
  {
    title: "Text & Planning",
    providers: [
      {
        id: "anthropic",
        name: "Anthropic Claude",
        initial: "A",
        color: "bg-orange-500",
        description:
          "Script analysis, scene planning, metadata generation, script writing assistant",
        envVars: ["ANTHROPIC_API_KEY"],
        getKeyHref: "https://console.anthropic.com/settings/keys",
      },
    ],
  },
  {
    title: "Video Generation",
    providers: [
      {
        id: "runway",
        name: "Runway ML",
        initial: "R",
        color: "bg-purple-600",
        description: "Generating video clips from shot descriptions",
        envVars: ["RUNWAYML_API_SECRET"],
        getKeyHref: "https://app.runwayml.com/",
      },
      {
        id: "kling",
        name: "Kling AI",
        initial: "K",
        color: "bg-sky-600",
        description: "Image-to-video generation for Kling Standard and Pro providers",
        envVars: ["KLING_API_KEY"],
        getKeyHref: "https://klingai.com/docs",
      },
      {
        id: "luma",
        name: "Luma Dream Machine",
        initial: "L",
        color: "bg-cyan-600",
        description: "Fast image-to-video generation with fluid motion",
        envVars: ["LUMA_API_KEY"],
        getKeyHref: "https://lumalabs.ai/dream-machine/api",
      },
      {
        id: "pika",
        name: "Pika",
        initial: "P",
        color: "bg-pink-600",
        description: "Stylized image-to-video generation for abstract and social-first clips",
        envVars: ["PIKA_API_KEY"],
        getKeyHref: "https://pika.art/api",
      },
      {
        id: "minimax",
        name: "MiniMax Hailuo",
        initial: "M",
        color: "bg-emerald-600",
        description: "Budget-friendly image-to-video generation",
        envVars: ["MINIMAX_API_KEY"],
        getKeyHref: "https://www.minimax.io/docs",
      },
      {
        id: "replicate",
        name: "Replicate",
        initial: "Re",
        color: "bg-blue-500",
        description: "Image generation and video generation fallback",
        envVars: ["REPLICATE_API_TOKEN"],
        getKeyHref: "https://replicate.com/account/api-tokens",
      },
    ],
  },
  {
    title: "Voice & Dialogue",
    providers: [
      {
        id: "elevenlabs",
        name: "ElevenLabs",
        initial: "EL",
        color: "bg-yellow-500",
        description: "Generating character voices and dialogue audio",
        envVars: ["ELEVENLABS_API_KEY"],
        getKeyHref: "https://elevenlabs.io/app/settings/api-keys",
      },
    ],
  },
  {
    title: "Music",
    providers: [
      {
        id: "mubert",
        name: "Mubert",
        initial: "M",
        color: "bg-green-600",
        description: "Text-to-music generation for scene underscore and narrator scores",
        envVars: ["MUBERT_COMPANY_ID", "MUBERT_LICENSE_TOKEN", "MUBERT_CUSTOMER_ID", "MUBERT_ACCESS_TOKEN"],
        getKeyHref: "https://mubert.com/api/docs",
      },
      {
        id: "epidemic",
        name: "Epidemic Sound",
        initial: "ES",
        color: "bg-red-500",
        description: "Royalty-free music library — Content ID protected",
        envVars: [],
        manual: true,
        manualNote:
          "Add tracks manually from the Epidemic Sound library to your Asset Registry.",
      },
    ],
  },
  {
    title: "Transcription",
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        initial: "OA",
        color: "bg-emerald-600",
        description:
          "Whisper API for speech-to-text transcription — generates accurate captions from the final audio mix",
        envVars: ["OPENAI_API_KEY"],
        getKeyHref: "https://platform.openai.com/api-keys",
      },
    ],
  },
  {
    title: "Compliance & Rights",
    providers: [
      {
        id: "audd",
        name: "AudD",
        initial: "Au",
        color: "bg-teal-600",
        description:
          "Music Content ID fingerprint pre-check before using any track in a video",
        envVars: ["AUDD_API_TOKEN"],
        getKeyHref: "https://dashboard.audd.io/",
      },
      {
        id: "synclabs",
        name: "Sync Labs",
        initial: "SL",
        color: "bg-indigo-500",
        description: "Lip sync alignment — matching mouth movement to dialogue",
        envVars: ["SYNCLABS_API_KEY"],
        getKeyHref: "https://sync.so/",
      },
    ],
  },
  {
    title: "Storage",
    providers: [
      {
        id: "r2",
        name: "Cloudflare R2",
        initial: "CF",
        color: "bg-orange-400",
        description: "Storing all generated video clips, audio files, and exports",
        envVars: [
          "R2_ACCOUNT_ID",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_BUCKET_NAME",
          "R2_PUBLIC_URL",
        ],
        getKeyHref: "https://dash.cloudflare.com/",
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: "connected" | "missing" | "manual";
}) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    );
  }
  if (status === "manual") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
        Manual — no API
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3" />
      Not configured
    </span>
  );
}

// ─── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  status,
  onStatusChange,
}: {
  provider: Provider;
  status: ProviderStatus | null;
  onStatusChange: (id: string, s: ProviderStatus) => void;
}) {
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyValues, setKeyValues] = useState<Record<string, string>>(
    Object.fromEntries(provider.envVars.map((k) => [k, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [disconnectResult, setDisconnectResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const isConfigured = status?.configured ?? false;
  const badgeStatus: "connected" | "missing" | "manual" = provider.manual
    ? "manual"
    : isConfigured
    ? "connected"
    : "missing";

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    setTestResult(null);

    // Build the key payload — for multi-key providers (R2) use JSON
    let keyPayload: string;
    if (provider.envVars.length > 1) {
      const filled = provider.envVars.filter((k) => keyValues[k]?.trim());
      if (filled.length === 0) {
        setSaveResult({ ok: false, message: "Enter at least one value before saving." });
        setSaving(false);
        return;
      }
      keyPayload = JSON.stringify(
        Object.fromEntries(provider.envVars.map((k) => [k, keyValues[k]?.trim() ?? ""]))
      );
    } else {
      const singleKey = provider.envVars[0];
      keyPayload = keyValues[singleKey]?.trim() ?? "";
      if (!keyPayload) {
        setSaveResult({ ok: false, message: "Enter a value before saving." });
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/settings/save-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, key: keyPayload }),
      });
      const json = await res.json();
      if (!json.success) {
        setSaveResult({ ok: false, message: json.error ?? "Save failed." });
        setSaving(false);
        return;
      }
    } catch {
      setSaveResult({ ok: false, message: "Network error — could not save key." });
      setSaving(false);
      return;
    }

    setSaveResult({ ok: true, message: "Key saved. Use Test connection to verify it works." });
    onStatusChange(provider.id, {
      configured: true,
      isVerified: false,
      lastTestedAt: status?.lastTestedAt ?? null,
    });
    setSaving(false);
    setShowKeyForm(false);
    setKeyValues(Object.fromEntries(provider.envVars.map((k) => [k, ""])));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/test-connection/${provider.id}`);
      const json = await res.json();
      setTestResult(json);
      if (json.connected) {
        onStatusChange(provider.id, {
          configured: true,
          isVerified: true,
          lastTestedAt: new Date().toISOString(),
        });
      }
    } catch {
      setTestResult({ connected: false, message: "Network error — could not reach server" });
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setSaveResult(null);
    setTestResult(null);
    setDisconnectResult(null);
    try {
      const res = await fetch(`/api/settings/providers/${provider.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not disconnect provider.");
      onStatusChange(provider.id, {
        configured: Boolean(json.data?.stillConfigured),
        isVerified: false,
        lastTestedAt: null,
      });
      setDisconnectResult({ ok: true, message: json.data?.message ?? "Provider disconnected." });
      setShowKeyForm(false);
      setConfirmDisconnect(false);
    } catch (err) {
      setDisconnectResult({
        ok: false,
        message: err instanceof Error ? err.message : "Could not disconnect provider.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold ${provider.color}`}
          >
            {provider.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{provider.name}</span>
              <StatusBadge status={badgeStatus} />
              {status?.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {provider.description}
            </p>
            {status?.isVerified && status.lastTestedAt && (
              <p className="mt-1 text-xs text-muted-foreground/70">
                Last verified: {formatDate(status.lastTestedAt)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {/* Env var labels */}
        {provider.envVars.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {provider.envVars.map((key) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs ${
                  isConfigured
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {key}
                {isConfigured && (
                  <span className="ml-0.5 text-green-600 dark:text-green-400">
                    ••••••••
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Manual note */}
        {provider.manual && provider.manualNote && (
          <p className="text-xs text-muted-foreground">{provider.manualNote}</p>
        )}

        {/* Actions */}
        {!provider.manual && (
          <div className="flex flex-wrap items-center gap-2">
            {provider.getKeyHref && (
              <a
                href={provider.getKeyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
              >
                How to get this key
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowKeyForm((v) => !v);
                setSaveResult(null);
                setTestResult(null);
                setDisconnectResult(null);
                setConfirmDisconnect(false);
              }}
              className="h-7 text-xs gap-1"
            >
              <KeyRound className="h-3 w-3" />
              {isConfigured ? "Update key" : "Enter key"}
              {showKeyForm ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing || saving || disconnecting}
              className="h-7 text-xs"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Testing…
                </>
              ) : (
                "Test connection"
              )}
            </Button>

            {isConfigured && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirmDisconnect(true);
                  setShowKeyForm(false);
                  setSaveResult(null);
                  setTestResult(null);
                  setDisconnectResult(null);
                }}
                disabled={testing || saving || disconnecting}
                className="h-7 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                Disconnect
              </Button>
            )}
          </div>
        )}

        {confirmDisconnect && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Disconnect {provider.name}?</p>
            <p className="mt-1 text-destructive/80">
              This removes the saved credential from ClipPilot. It will not delete files, projects, generated media, or assets already stored with that provider.
            </p>
            {provider.id === "r2" && (
              <p className="mt-1 text-destructive/80">
                R2 files in Cloudflare are not deleted. If no R2 env vars are set, storage will fall back to local.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="h-7 text-xs"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Disconnecting…
                  </>
                ) : (
                  "Yes, disconnect"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDisconnect(false)}
                disabled={disconnecting}
                className="h-7 text-xs"
              >
                Keep connected
              </Button>
            </div>
          </div>
        )}

        {/* Key entry form */}
        {showKeyForm && (
          <div className="rounded-md border bg-muted/30 p-3 flex flex-col gap-3">
            {provider.envVars.map((envKey) => (
              <div key={envKey} className="flex flex-col gap-1.5">
                <Label className="font-mono text-xs">{envKey}</Label>
                <Input
                  type="password"
                  placeholder={
                    isConfigured
                      ? "••••••••••••••••  (leave blank to keep existing)"
                      : `Paste your ${envKey} here`
                  }
                  value={keyValues[envKey] ?? ""}
                  onChange={(e) =>
                    setKeyValues((prev) => ({ ...prev, [envKey]: e.target.value }))
                  }
                  className="font-mono text-xs h-8"
                  autoComplete="off"
                />
              </div>
            ))}

            {isConfigured && (
              <p className="text-xs text-muted-foreground">
                A key is already saved. Enter a new value above to replace it.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowKeyForm(false);
                  setSaveResult(null);
                }}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>

            {saveResult && (
              <p
                className={`text-xs ${
                  saveResult.ok
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}
              >
                <span className="flex items-center gap-1">
                  {saveResult.ok ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {saveResult.message}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Standalone test result (from "Test connection" button) */}
        {testResult && !showKeyForm && (
          <div
            className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${
              testResult.connected
                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {testResult.connected ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {testResult.message}
          </div>
        )}

        {disconnectResult && (
          <div
            className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${
              disconnectResult.ok
                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {disconnectResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {disconnectResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function AiProvidersTab() {
  const [providerStatus, setProviderStatus] = useState<AllProviderStatus>({});

  const refreshStatus = useCallback(() => {
    fetch("/api/settings/provider-status")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setProviderStatus(json.data as AllProviderStatus);
      })
      .catch(() => {/* DB not available — no status to show */});
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  function handleStatusChange(id: string, s: ProviderStatus) {
    setProviderStatus((prev) => ({ ...prev, [id]: s }));
  }

  return (
    <div className="flex flex-col gap-8">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {section.title}
          </h3>
          <div className="flex flex-col gap-3">
            {section.providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                status={providerStatus[provider.id] ?? null}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
