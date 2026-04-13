"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock } from "lucide-react";
import type { EnvStatus } from "@/lib/env-status";

interface Toggle {
  id: string;
  label: string;
  description: string;
  locked?: boolean;
  lockedMessage?: string;
  warning?: (envStatus: EnvStatus) => string | null;
  note?: string;
}

const TOGGLES: Toggle[] = [
  {
    id: "ai_disclosure",
    label: "AI Disclosure Overlay",
    description:
      'Adds a 3-second "AI Generated Content" text overlay to the start of every exported video. Required by YouTube, TikTok, and Instagram for realistic AI-generated content.',
    locked: true,
    lockedMessage:
      "This setting is locked ON to protect you from platform policy violations.",
  },
  {
    id: "content_id_check",
    label: "Content ID Pre-Check",
    description:
      "Runs every music track through AudD fingerprint detection before it can be used. Requires AudD API key.",
    warning: (envStatus) =>
      !envStatus.AUDD_API_TOKEN
        ? "Content ID pre-check is disabled — AudD API key not configured. Music may trigger copyright claims on YouTube and TikTok."
        : null,
  },
  {
    id: "likeness_detection",
    label: "Likeness Detection",
    description:
      "Scans generated video frames for faces resembling real public figures before finalising any shot.",
    note: "Manual review mode — automatic detection coming in a future update.",
  },
  {
    id: "provenance_report",
    label: "Export Provenance Report",
    description:
      "Generates a PDF asset provenance report alongside every video export listing every asset, its licence, and compliance check results.",
  },
];

interface Props {
  envStatus: EnvStatus;
}

const STORAGE_KEY = "clippilot_compliance_settings";

function loadDefaults(): Record<string, boolean> {
  return {
    ai_disclosure: true,
    content_id_check: true,
    likeness_detection: true,
    provenance_report: true,
  };
}

export function ComplianceTab({ envStatus }: Props) {
  const [values, setValues] = useState<Record<string, boolean>>(loadDefaults);
  const [lockedFlash, setLockedFlash] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        // Always force ai_disclosure ON
        setValues({ ...loadDefaults(), ...parsed, ai_disclosure: true });
      }
    } catch {
      // ignore
    }
  }, []);

  function handleChange(id: string, value: boolean) {
    if (id === "ai_disclosure") {
      setLockedFlash(true);
      setTimeout(() => setLockedFlash(false), 2000);
      return;
    }
    const next = { ...values, [id]: value };
    setValues(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {TOGGLES.map((toggle) => {
        const isLocked = toggle.locked === true;
        const isOn = isLocked ? true : (values[toggle.id] ?? true);
        const warning = toggle.warning?.(envStatus) ?? null;
        const showLockedMsg = isLocked && lockedFlash;

        return (
          <Card key={toggle.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-base flex items-center gap-2">
                    {toggle.label}
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Lock className="h-3 w-3" />
                        Locked ON
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm">{toggle.description}</CardDescription>
                </div>
                <Switch
                  id={toggle.id}
                  checked={isOn}
                  onCheckedChange={(v) => handleChange(toggle.id, v)}
                  className="shrink-0 mt-0.5"
                />
              </div>
            </CardHeader>

            {(showLockedMsg || warning || toggle.note) && (
              <CardContent className="flex flex-col gap-2 pt-0">
                {showLockedMsg && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    {toggle.lockedMessage}
                  </div>
                )}
                {warning && !isLocked && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {warning}
                  </div>
                )}
                {toggle.note && (
                  <p className="text-xs text-muted-foreground">{toggle.note}</p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
