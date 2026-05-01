"use client";

import { getProviderConfig, splitDurationForProvider } from "@/lib/video-providers/registry";

type CostEstimatorProps = {
  providerId: string;
  scenes: Array<{ durationSeconds: number }>;
};

export function CostEstimator({ providerId, scenes }: CostEstimatorProps) {
  const provider = getProviderConfig(providerId);
  let totalClips = 0;
  let totalCostUsd = 0;

  const breakdown = scenes.map((scene, index) => {
    const durations = splitDurationForProvider(Math.max(scene.durationSeconds || 5, 0.1), provider);
    const cost = durations.reduce((sum, duration) => sum + (provider.pricing[duration] ?? 0), 0);
    totalClips += durations.length;
    totalCostUsd += cost;
    return { index, durations, cost };
  });

  const estimatedMinutes = Math.max(1, Math.ceil((totalClips * 60) / 60));

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Cost Estimate</span>
        <span className="text-xs text-muted-foreground">Approximate provider pricing</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="clips" value={String(totalClips)} />
          <Stat label="est. cost" value={`$${totalCostUsd.toFixed(2)}`} tone="green" />
          <Stat label="est. time" value={`~${estimatedMinutes}m`} />
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {breakdown.map((row) => (
            <div key={row.index} className="grid grid-cols-[80px_1fr_70px] gap-2 border-b py-1 last:border-0">
              <span className="text-muted-foreground">Scene {row.index + 1}</span>
              <span>{row.durations.map((duration) => `${duration}s`).join(" + ")}</span>
              <span className="text-right font-mono">${row.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="rounded-md bg-background p-2 text-center">
      <div className={tone === "green" ? "text-lg font-bold text-green-600" : "text-lg font-bold"}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
