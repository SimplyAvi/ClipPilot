"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { RunwayQueuePanel } from "@/components/runway/runway-queue-panel";
import { RunwayTestButton } from "@/components/runway/runway-test-button";
import { AspectRatioSelector } from "@/components/video-providers/aspect-ratio-selector";
import { CostEstimator } from "@/components/video-providers/cost-estimator";
import { ProviderSelector } from "@/components/video-providers/provider-selector";
import { getProviderConfig, VIDEO_PROVIDERS } from "@/lib/video-providers/registry";
import type { VideoAspectRatio } from "@/lib/video-providers/types";
import { Download, Loader2, Play, Upload, Video } from "lucide-react";

type RunwayClipView = {
  id: string;
  clipId: string;
  sceneIndex: number;
  clipIndex: number;
  durationSeconds: number;
  status: string;
  videoUrl: string | null;
};

type AssembledView = {
  id: string;
  videoPath: string;
  videoUrl: string;
  durationSec: number;
  status: string;
} | null;

type RunwayGenerationPanelProps = {
  projectId: string;
  initialClipCount: number;
  initialClips: RunwayClipView[];
  initialAssembled: AssembledView;
  projectVideoProvider?: string | null;
  projectVideoAspectRatio?: string | null;
  sceneDurations: Array<{ durationSeconds: number }>;
};

export function RunwayGenerationPanel({
  projectId,
  initialClipCount,
  initialClips,
  initialAssembled,
  projectVideoProvider,
  projectVideoAspectRatio,
  sceneDurations,
}: RunwayGenerationPanelProps) {
  const [providerId, setProviderId] = useState(projectVideoProvider ?? "runway");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(normalizeAspectRatio(projectVideoAspectRatio));
  const [configuredProviders, setConfiguredProviders] = useState<string[]>(["runway"]);
  const [clips, setClips] = useState(initialClips);
  const [assembled, setAssembled] = useState(initialAssembled);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const { job } = useGenerationStream(projectId);
  const provider = getProviderConfig(providerId);

  const completed = clips.filter((clip) => clip.status === "complete").length;
  const running = job?.status === "running" || job?.status === "queued";
  const estimatedClipCount = clips.length || initialClipCount;
  const estimatedMinutes = Math.max(1, Math.ceil((estimatedClipCount * 45) / 60));

  useEffect(() => {
    refreshClips();
    refreshProviderStatus();
    const es = new EventSource(`/api/generation/${projectId}/stream`);
    es.addEventListener("clip_complete", () => refreshClips());
    es.addEventListener("assembly_complete", () => refreshClips());
    return () => es.close();
  }, [projectId]);

  async function refreshProviderStatus() {
    const res = await fetch("/api/settings/provider-status", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const statuses = json.data ?? {};
    setConfiguredProviders(
      VIDEO_PROVIDERS
        .filter((provider) => statuses[provider.providerKeyId]?.configured)
        .map((provider) => provider.providerKeyId)
    );
  }

  async function refreshClips() {
    const res = await fetch(`/api/projects/${projectId}/runway/clips`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setClips(json.data.clips ?? []);
    setAssembled(json.data.assembled ?? null);
  }

  async function startRunwayGeneration() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/runway/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, aspectRatio }),
      });
      const json = await res.json();
      if (!res.ok) {
        const missing = json.data?.missing?.length ? ` Missing: ${json.data.missing.join(", ")}` : "";
        throw new Error(`${json.error ?? "Could not start Runway generation"}${missing}`);
      }
      await refreshClips();
      setStreamKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Runway generation");
    } finally {
      setStarting(false);
    }
  }

  async function cancelRunwayGeneration() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/runway/cancel`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not cancel Runway generation");
      await refreshClips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel Runway generation");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card className="border-slate-300">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Video className="h-5 w-5 text-blue-600" />
              Generate Video
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {estimatedClipCount} clip{estimatedClipCount === 1 ? "" : "s"} estimated · about {estimatedMinutes} min · clips render sequentially for continuity
            </p>
          </div>
          <Badge variant={assembled ? "default" : running ? "secondary" : "outline"} className="capitalize">
            {running && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {assembled ? "assembled" : job?.currentStageLabel ?? "ready"}
          </Badge>
        </div>

        {assembled?.videoUrl && (
          <div className="overflow-hidden rounded-lg border bg-black">
            <video controls className="aspect-video w-full" src={assembled.videoUrl} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border bg-amber-50/40 p-4">
          <div>
            <p className="text-sm font-semibold">Before you generate all clips</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Run one quick test to confirm {provider.label} is connected and your public scene image URLs render correctly.
            </p>
          </div>
          <RunwayTestButton projectId={projectId} providerId={providerId} providerLabel={provider.label} aspectRatio={aspectRatio} />
        </div>

        <div className="border-t" />

        <ProviderSelector value={providerId} onChange={setProviderId} configuredProviders={configuredProviders} />
        <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
        <CostEstimator providerId={providerId} scenes={sceneDurations.length > 0 ? sceneDurations : [{ durationSeconds: 5 }]} />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="flex flex-wrap gap-2">
            {assembled?.videoUrl && (
              <Button variant="outline" asChild>
                <a href={assembled.videoUrl} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download Final Video
                </a>
              </Button>
            )}
            {assembled && (
              <Button variant="outline" asChild>
                <Link href={`/projects/${projectId}/publish`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Publish to Social
                </Link>
              </Button>
            )}
            <Button onClick={startRunwayGeneration} disabled={starting || running}>
              {starting || running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {running ? "Video Generation Running" : `Start ${provider.label}`}
            </Button>
            {running && (
              <Button variant="destructive" onClick={cancelRunwayGeneration} disabled={cancelling}>
                {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Stop Generation
              </Button>
            )}
          </div>
        </div>

        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <RunwayQueuePanel key={streamKey} projectId={projectId} />

        <p className="text-xs text-muted-foreground">
          Dev note: if you are using local storage, video providers must be able to reach this app URL. Use R2 or expose localhost with a tunnel and set RUNWAY_PUBLIC_BASE_URL.
        </p>
      </CardContent>
    </Card>
  );
}

function normalizeAspectRatio(value?: string | null): VideoAspectRatio {
  if (value === "9:16" || value === "4:3" || value === "1:1" || value === "16:9") return value;
  if (value === "720:1280") return "9:16";
  if (value === "1104:832") return "4:3";
  return "16:9";
}
