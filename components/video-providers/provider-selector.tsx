"use client";

import { Badge } from "@/components/ui/badge";
import { VIDEO_PROVIDERS } from "@/lib/video-providers/registry";
import { cn } from "@/lib/utils";

type ProviderSelectorProps = {
  value: string;
  onChange: (providerId: string) => void;
  configuredProviders: string[];
};

export function ProviderSelector({ value, onChange, configuredProviders }: ProviderSelectorProps) {
  const selected = VIDEO_PROVIDERS.find((provider) => provider.id === value) ?? VIDEO_PROVIDERS[0];

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Video Generation Platform
      </label>
      <select
        value={selected.id}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
      >
        {VIDEO_PROVIDERS.map((provider) => {
          const configured = configuredProviders.includes(provider.providerKeyId);
          const prices = Object.entries(provider.pricing)
            .map(([duration, cost]) => `${duration}s $${cost.toFixed(2)}`)
            .join(" / ");
          return (
            <option key={provider.id} value={provider.id} disabled={!configured}>
              {provider.label} - {prices}{configured ? "" : " - No API Key"}
            </option>
          );
        })}
      </select>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{selected.label}</span>
          {selected.badge && (
            <Badge className={cn("text-xs", selected.badgeColor)}>{selected.badge}</Badge>
          )}
          {!configuredProviders.includes(selected.providerKeyId) && (
            <Badge variant="outline" className="text-xs">No API Key</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Clip lengths: <strong className="text-foreground">{selected.allowedDurations.join("s, ")}s</strong></span>
          <span>End frame: <strong className={selected.supportsEndFrame ? "text-green-600" : "text-amber-600"}>{selected.supportsEndFrame ? "Supported" : "Not supported"}</strong></span>
          <span>Max res: <strong className="text-foreground">{selected.maxResolution}</strong></span>
          <a href={selected.docsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Docs
          </a>
        </div>
      </div>

      {!selected.supportsEndFrame && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {selected.label} does not support end-frame guidance. Scene continuity will rely on the starting image and motion prompt, so transitions may be less smooth.
        </div>
      )}
    </div>
  );
}
