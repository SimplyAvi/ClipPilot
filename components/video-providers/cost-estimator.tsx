"use client";

import { getProviderConfig, splitDurationForProvider } from "@/lib/video-providers/registry";

type CostEstimatorProps = {
  providerId: string;
  scenes: Array<{ durationSeconds: number }>;
  plannedClips?: Array<{
    sceneIndex: number;
    durationSeconds: number;
    status: string;
    videoUrl?: string | null;
  }>;
};

export function CostEstimator({ providerId, scenes, plannedClips = [] }: CostEstimatorProps) {
  const provider = getProviderConfig(providerId);
  let totalClips = 0;
  let totalCostUsd = 0;

  const breakdown = plannedClips.length > 0 ? buildBreakdownFromPlannedClips(plannedClips, provider) : scenes.map((scene, index) => {
    const durations = splitDurationForProvider(Math.max(scene.durationSeconds || 5, 0.1), provider);
    const cost = durations.reduce((sum, duration) => sum + (provider.pricing[duration] ?? 0), 0);
    totalClips += durations.length;
    totalCostUsd += cost;
    return { index, durations, cost, completed: 0 };
  });
  if (plannedClips.length > 0) {
    totalClips = breakdown.reduce((sum, row) => sum + row.durations.length, 0);
    totalCostUsd = breakdown.reduce((sum, row) => sum + row.cost, 0);
  }

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
              <span>
                {row.durations.map((duration) => `${duration}s`).join(" + ")}
                {row.completed > 0 && <span className="ml-2 text-green-600">({row.completed} ready)</span>}
              </span>
              <span className="text-right font-mono">${row.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildBreakdownFromPlannedClips(
  clips: NonNullable<CostEstimatorProps["plannedClips"]>,
  provider: ReturnType<typeof getProviderConfig>
) {
  const grouped = clips.reduce<Record<number, NonNullable<CostEstimatorProps["plannedClips"]>>>((acc, clip) => {
    acc[clip.sceneIndex] ??= [];
    acc[clip.sceneIndex].push(clip);
    return acc;
  }, {});
  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([sceneIndex, sceneClips]) => {
      const durations = sceneClips.map((clip) => clip.durationSeconds);
      return {
        index: Number(sceneIndex),
        durations,
        cost: sceneClips.reduce((sum, clip) => sum + (isReady(clip) ? 0 : provider.pricing[clip.durationSeconds] ?? 0), 0),
        completed: sceneClips.filter(isReady).length,
      };
    });
}

function isReady(clip: { status: string; videoUrl?: string | null }) {
  return clip.status === "complete" || Boolean(clip.videoUrl);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="rounded-md bg-background p-2 text-center">
      <div className={tone === "green" ? "text-lg font-bold text-green-600" : "text-lg font-bold"}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
