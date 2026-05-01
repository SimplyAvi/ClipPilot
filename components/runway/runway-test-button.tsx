"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { VideoAspectRatio } from "@/lib/video-providers/types";

type TestState = "idle" | "submitting" | "generating" | "done" | "error";

export function RunwayTestButton({
  projectId,
  providerId = "runway",
  providerLabel = "Runway",
  aspectRatio = "16:9",
  onComplete,
}: {
  projectId: string;
  providerId?: string;
  providerLabel?: string;
  aspectRatio?: VideoAspectRatio;
  onComplete?: () => void | Promise<void>;
}) {
  const [state, setState] = useState<TestState>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function runTest() {
    setState("submitting");
    setError(null);
    setVideoUrl(null);
    setElapsed(0);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      setState("generating");
      const res = await fetch(`/api/projects/${projectId}/runway/test-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, aspectRatio }),
      });
      const data = await parseJsonResponse(res);
      clearInterval(timer);

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unknown Runway error");
        setState("error");
        return;
      }

      if (!data.videoUrl) {
        setError("The provider returned success, but no video URL was included.");
        setState("error");
        return;
      }
      setVideoUrl(data.videoUrl);
      setState("done");
      await onComplete?.();
    } catch (err) {
      clearInterval(timer);
      setError(err instanceof Error ? err.message : "Unknown Runway error");
      setState("error");
    }
  }

  const busy = state === "submitting" || state === "generating";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={runTest}
          disabled={busy}
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {state === "idle" && `Test ${providerLabel} (1 clip)`}
          {state === "submitting" && `Submitting to ${providerLabel}...`}
          {state === "generating" && `Generating... ${elapsed}s`}
          {state === "done" && "Test Passed - Run Again"}
          {state === "error" && "Failed - Retry"}
        </Button>

        {busy && (
          <span className="text-xs text-muted-foreground">
            Usually takes 30-90 seconds
          </span>
        )}
      </div>

      {state === "error" && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-1 font-semibold">{providerLabel} Error</p>
          <p className="font-mono text-xs">{error}</p>
          <p className="mt-2 text-xs text-red-600/80">
            Check your provider API key, R2 public URL, and whether the scene image URL is reachable.
          </p>
        </div>
      )}

      {state === "done" && videoUrl && (
        <div className="overflow-hidden rounded-lg border border-green-200 bg-green-50/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-green-200 px-3 py-2">
            <span className="text-xs font-semibold text-green-700">
              Test clip generated in {elapsed}s
            </span>
            <span className="text-xs text-muted-foreground">Test clip · {providerLabel}</span>
          </div>
          <video src={videoUrl} controls autoPlay loop muted className="max-h-56 w-full bg-black" />
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Looks good? Start full video generation to process all clips.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

async function parseJsonResponse(res: Response): Promise<{ ok?: boolean; error?: string; videoUrl?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      error: `The test endpoint returned an empty response (${res.status}). Check the server log for the underlying error.`,
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `The test endpoint returned non-JSON (${res.status}): ${text.slice(0, 300)}`,
    };
  }
}
