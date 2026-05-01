import { downloadRunwayClip, pollRunwayClipOnce, submitRunwayClip } from "@/lib/runway/client";
import type { VideoAspectRatio, VideoClipRequest, VideoProviderAdapter } from "../types";

export class RunwayAdapter implements VideoProviderAdapter {
  async submit(req: VideoClipRequest): Promise<string> {
    if (req.durationSeconds !== 5 && req.durationSeconds !== 10) {
      throw new Error("Runway only supports 5s or 10s clips.");
    }
    return submitRunwayClip({
      promptImage: req.startImageUrl,
      promptImageEnd: req.endImageUrl ?? req.startImageUrl,
      seconds: req.durationSeconds,
      ratio: aspectRatioToRunway(req.aspectRatio),
      model: "gen3a_turbo",
      promptText: req.motionPrompt,
    });
  }

  async poll(taskId: string) {
    const result = await pollRunwayClipOnce(taskId);
    return { status: result.status, outputUrl: result.outputUrl, error: result.error };
  }

  async download(outputUrl: string, destPath: string): Promise<void> {
    await downloadRunwayClip(outputUrl, destPath);
  }
}

function aspectRatioToRunway(ratio: VideoAspectRatio): "1280:768" | "768:1280" {
  if (ratio === "9:16") return "768:1280";
  return "1280:768";
}
