import { KlingAdapter } from "@/lib/video-providers/adapters/kling";
import { LumaAdapter } from "@/lib/video-providers/adapters/luma";
import { MinimaxAdapter } from "@/lib/video-providers/adapters/minimax";
import { PikaAdapter } from "@/lib/video-providers/adapters/pika";
import { RunwayAdapter } from "@/lib/video-providers/adapters/runway";
import { StableVideoAdapter } from "@/lib/video-providers/adapters/stable-video";
import type { VideoProviderAdapter } from "@/lib/video-providers/types";

export function getVideoProvider(providerId: string): VideoProviderAdapter {
  switch (providerId) {
    case "runway":
      return new RunwayAdapter();
    case "kling_standard":
      return new KlingAdapter("standard");
    case "kling_pro":
      return new KlingAdapter("pro");
    case "luma":
      return new LumaAdapter();
    case "pika":
      return new PikaAdapter();
    case "minimax":
      return new MinimaxAdapter();
    case "stable_video":
      return new StableVideoAdapter();
    default:
      throw new Error(`Unknown video provider: ${providerId}`);
  }
}

export {
  VIDEO_PROVIDERS,
  chooseDuration,
  getProviderConfig,
  splitDurationForProvider,
} from "@/lib/video-providers/registry";
export type {
  VideoAspectRatio,
  VideoClipRequest,
  VideoClipResult,
  VideoProviderAdapter,
} from "@/lib/video-providers/types";
