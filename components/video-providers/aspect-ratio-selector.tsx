"use client";

import type { VideoAspectRatio } from "@/lib/video-providers/types";
import { cn } from "@/lib/utils";

const RATIOS: Array<{ value: VideoAspectRatio; label: string; icon: string; note: string }> = [
  { value: "16:9", label: "Landscape", icon: "▬", note: "YouTube" },
  { value: "9:16", label: "Portrait", icon: "▮", note: "TikTok/Reels" },
  { value: "1:1", label: "Square", icon: "■", note: "Feed" },
  { value: "4:3", label: "Classic", icon: "▭", note: "Traditional" },
];

export function AspectRatioSelector({
  value,
  onChange,
}: {
  value: VideoAspectRatio;
  onChange: (value: VideoAspectRatio) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Aspect Ratio
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATIOS.map((ratio) => (
          <button
            key={ratio.value}
            type="button"
            onClick={() => onChange(ratio.value)}
            className={cn(
              "rounded-lg border p-3 text-center text-xs transition",
              value === ratio.value
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
            )}
          >
            <span className="block text-lg leading-none">{ratio.icon}</span>
            <span className="mt-1 block font-mono font-bold">{ratio.value}</span>
            <span className="block">{ratio.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
