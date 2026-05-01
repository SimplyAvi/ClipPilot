export interface VideoProviderConfig {
  id: string;
  label: string;
  description: string;
  allowedDurations: number[];
  pricing: Record<number, number>;
  providerKeyId: string;
  supportsEndFrame: boolean;
  maxResolution: string;
  badge?: string;
  badgeColor?: string;
  docsUrl: string;
}

export const VIDEO_PROVIDERS: VideoProviderConfig[] = [
  {
    id: "runway",
    label: "Runway Gen-3 Alpha Turbo",
    description: "Cinematic quality, best for dramatic visuals",
    allowedDurations: [5, 10],
    pricing: { 5: 0.25, 10: 0.5 },
    providerKeyId: "runway",
    supportsEndFrame: true,
    maxResolution: "1280x720",
    badge: "Best Quality",
    badgeColor: "bg-purple-100 text-purple-700",
    docsUrl: "https://docs.runwayml.com",
  },
  {
    id: "kling_standard",
    label: "Kling AI 1.6 - Standard",
    description: "Great motion quality at a lower cost",
    allowedDurations: [5, 10],
    pricing: { 5: 0.14, 10: 0.28 },
    providerKeyId: "kling",
    supportsEndFrame: true,
    maxResolution: "1280x720",
    docsUrl: "https://klingai.com/docs",
  },
  {
    id: "kling_pro",
    label: "Kling AI 1.6 - Pro",
    description: "Higher fidelity, more realistic motion",
    allowedDurations: [5, 10],
    pricing: { 5: 0.35, 10: 0.7 },
    providerKeyId: "kling",
    supportsEndFrame: true,
    maxResolution: "1920x1080",
    badge: "High Fidelity",
    badgeColor: "bg-blue-100 text-blue-700",
    docsUrl: "https://klingai.com/docs",
  },
  {
    id: "luma",
    label: "Luma Dream Machine",
    description: "Fast generation, fluid motion",
    allowedDurations: [5, 9],
    pricing: { 5: 0.15, 9: 0.25 },
    providerKeyId: "luma",
    supportsEndFrame: true,
    maxResolution: "1280x720",
    badge: "Fastest",
    badgeColor: "bg-cyan-100 text-cyan-700",
    docsUrl: "https://lumalabs.ai/dream-machine/api",
  },
  {
    id: "pika",
    label: "Pika 2.1",
    description: "Stylized motion, great for abstract visuals",
    allowedDurations: [3, 5],
    pricing: { 3: 0.08, 5: 0.13 },
    providerKeyId: "pika",
    supportsEndFrame: false,
    maxResolution: "1280x720",
    docsUrl: "https://pika.art/api",
  },
  {
    id: "minimax",
    label: "MiniMax (Hailuo)",
    description: "Budget-friendly, solid for b-roll",
    allowedDurations: [6],
    pricing: { 6: 0.06 },
    providerKeyId: "minimax",
    supportsEndFrame: false,
    maxResolution: "1280x720",
    badge: "Most Affordable",
    badgeColor: "bg-green-100 text-green-700",
    docsUrl: "https://www.minimax.io/docs",
  },
  {
    id: "stable_video",
    label: "Stable Video Diffusion (Replicate)",
    description: "Open source, lowest cost, basic motion",
    allowedDurations: [4],
    pricing: { 4: 0.04 },
    providerKeyId: "replicate",
    supportsEndFrame: false,
    maxResolution: "1024x576",
    docsUrl: "https://replicate.com/stability-ai/stable-video-diffusion",
  },
];

export function getProviderConfig(id: string): VideoProviderConfig {
  const config = VIDEO_PROVIDERS.find((provider) => provider.id === id);
  if (!config) throw new Error(`Unknown video provider: ${id}`);
  return config;
}

export function chooseDuration(provider: VideoProviderConfig, requiredSeconds: number): number {
  const sorted = [...provider.allowedDurations].sort((a, b) => b - a);
  return sorted.find((duration) => duration <= requiredSeconds) ?? sorted[sorted.length - 1];
}

export function splitDurationForProvider(totalSeconds: number, provider: VideoProviderConfig): number[] {
  const minimum = Math.min(...provider.allowedDurations);
  if (totalSeconds <= minimum) return [minimum];
  const clips: number[] = [];
  let remaining = totalSeconds;
  while (remaining > 0) {
    const duration = chooseDuration(provider, remaining);
    clips.push(duration);
    remaining -= duration;
  }
  return clips;
}
