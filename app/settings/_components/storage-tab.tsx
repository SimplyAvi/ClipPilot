"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, HardDrive } from "lucide-react";
import type { EnvStatus } from "@/lib/env-status";

const R2_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;

interface Props {
  envStatus: EnvStatus;
}

export function StorageTab({ envStatus }: Props) {
  const r2Connected = R2_VARS.every((k) => envStatus[k]);

  const [useLocal, setUseLocal] = useState(false);

  // Persist toggle to localStorage
  useEffect(() => {
    const stored = localStorage.getItem("clippilot_use_local_storage");
    if (stored === "true") setUseLocal(true);
  }, []);

  function handleLocalToggle(value: boolean) {
    setUseLocal(value);
    localStorage.setItem("clippilot_use_local_storage", String(value));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* R2 status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cloudflare R2</CardTitle>
          <CardDescription>Primary storage for all generated video clips, audio, and exports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {r2Connected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Connected — all credentials configured
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <span className="text-sm font-medium text-destructive">
                  Not configured — missing{" "}
                  {R2_VARS.filter((k) => !envStatus[k]).join(", ")}
                </span>
              </>
            )}
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Required variables</p>
            <ul className="flex flex-col gap-1">
              {R2_VARS.map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      envStatus[key] ? "bg-green-500" : "bg-destructive"
                    }`}
                  />
                  <code className="text-xs">{key}</code>
                  <span className="text-xs text-muted-foreground">
                    {envStatus[key] ? "set" : "missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Local fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Local Storage Fallback
          </CardTitle>
          <CardDescription>
            Until Cloudflare R2 is configured, generated files will be saved locally to{" "}
            <code className="text-xs">/generated-media/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="local-storage-toggle"
              checked={useLocal}
              onCheckedChange={handleLocalToggle}
            />
            <Label htmlFor="local-storage-toggle" className="cursor-pointer">
              Use local storage only
            </Label>
          </div>

          {useLocal && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Local storage mode is active. Files are saved to{" "}
                <code className="text-xs">/generated-media/</code> on this machine.
                Set <code className="text-xs">USE_LOCAL_STORAGE=true</code> in{" "}
                <code className="text-xs">.env.local</code> to make this permanent.
              </span>
            </div>
          )}

          {!r2Connected && !useLocal && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                R2 is not configured and local storage mode is off. Exports may fail.
                Enable local storage above or configure your R2 credentials.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
