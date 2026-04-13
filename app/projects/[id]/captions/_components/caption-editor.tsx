"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  Download,
  Captions,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptionSegment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

interface Transcription {
  id: string;
  language: string | null;
  durationSec: number | null;
  captionStyle: CaptionStyle | null;
  segments: CaptionSegment[];
}

interface CaptionStyle {
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: "bottom" | "top" | "center";
  fontFamily?: string;
}

const STYLE_PRESETS: { label: string; style: CaptionStyle }[] = [
  {
    label: "Clean White",
    style: {
      fontSize: 24,
      fontColor: "white",
      backgroundColor: "black@0.5",
      position: "bottom",
      fontFamily: "Arial",
    },
  },
  {
    label: "Bold Yellow",
    style: {
      fontSize: 28,
      fontColor: "#FFD700",
      backgroundColor: "black@0.7",
      position: "bottom",
      fontFamily: "Arial Bold",
    },
  },
  {
    label: "Minimal",
    style: {
      fontSize: 20,
      fontColor: "white",
      backgroundColor: "black@0.2",
      position: "bottom",
      fontFamily: "Helvetica",
    },
  },
  {
    label: "High Contrast",
    style: {
      fontSize: 26,
      fontColor: "black",
      backgroundColor: "white@0.9",
      position: "bottom",
      fontFamily: "Arial",
    },
  },
];

// ─── Time formatting ──────────────────────────────────────────────────────────

function secToDisplay(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

function displayToSec(str: string): number {
  const parts = str.split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(str) || 0;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CaptionEditor({
  projectId,
  videoUrl,
  initialTranscription,
}: {
  projectId: string;
  videoUrl: string | null;
  initialTranscription: Transcription | null;
}) {
  const [transcription, setTranscription] = useState<Transcription | null>(
    initialTranscription
  );
  const [segments, setSegments] = useState<CaptionSegment[]>(
    initialTranscription?.segments ?? []
  );
  const [activeStyle, setActiveStyle] = useState<string>("Clean White");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Track which segment is active during playback
  const activeSegmentId =
    segments.find((s) => currentTime >= s.startSec && currentTime <= s.endSec)?.id ?? null;

  // Scroll the active row into view
  const activeRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeSegmentId]);

  // ── Auto-generate captions ─────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/captions/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.settingsLink) {
          setError(`${json.error} → Go to Settings → AI Providers → Transcription`);
        } else {
          setError(json.error ?? "Transcription failed");
        }
        return;
      }
      const t: Transcription = json.data.transcription;
      setTranscription(t);
      setSegments(t.segments);
    } catch {
      setError("Network error — could not start transcription");
    } finally {
      setGenerating(false);
    }
  }, [projectId]);

  // ── Save edits ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/captions/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segments.map((s, i) => ({ ...s, index: i })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      setTranscription(json.data);
      setSegments(json.data.segments);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error — could not save");
    } finally {
      setSaving(false);
    }
  }, [projectId, segments]);

  // ── Segment edit helpers ───────────────────────────────────────────────────

  function updateSegment(id: string, field: keyof CaptionSegment, value: string | number) {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function addSegment() {
    const last = segments[segments.length - 1];
    const newStart = last ? last.endSec + 0.1 : 0;
    setSegments((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        index: prev.length,
        startSec: newStart,
        endSec: newStart + 2,
        text: "",
      },
    ]);
  }

  function deleteSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, index: i })));
  }

  // ── Seek video to segment start on row click ───────────────────────────────

  function seekTo(sec: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  }

  // ── Download helpers ───────────────────────────────────────────────────────

  function download(format: "srt" | "vtt" | "tiktok") {
    window.open(`/api/captions/${projectId}/download?format=${format}`, "_blank");
  }

  const captionCount = segments.length;
  const totalDuration = transcription?.durationSec
    ? `${Math.floor(transcription.durationSec / 60)}m ${Math.floor(transcription.durationSec % 60)}s`
    : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left — Video player */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-md bg-black"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                No video available — export a video first
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caption style */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Caption Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setActiveStyle(preset.label)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeStyle === preset.label
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        {captionCount > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export Captions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => download("srt")}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download .srt
                </Button>
                <Button size="sm" variant="outline" onClick={() => download("vtt")}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download .vtt
                </Button>
                <Button size="sm" variant="outline" onClick={() => download("tiktok")}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  TikTok JSON
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                To burn captions into the video, use the option on the{" "}
                <a href={`/projects/${projectId}/export`} className="text-primary underline-offset-4 hover:underline">
                  Export page
                </a>
                .
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right — Caption list */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Transcribing…
                </>
              ) : (
                <>
                  <Captions className="mr-1.5 h-3.5 w-3.5" />
                  Auto-generate captions
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={addSegment}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add caption
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {transcription && (
              <div className="flex gap-2">
                <Badge variant="secondary">{captionCount} captions</Badge>
                {totalDuration && <Badge variant="outline">{totalDuration}</Badge>}
              </div>
            )}
            {segments.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                    Saved
                  </>
                ) : (
                  "Save edits"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {error}
              {error.includes("Settings") && (
                <a
                  href="/settings"
                  className="ml-1 inline-flex items-center gap-1 underline underline-offset-2"
                >
                  Open Settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Segments */}
        {segments.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-md border bg-muted/30 text-center text-sm text-muted-foreground">
            <Captions className="mb-2 h-8 w-8 opacity-30" />
            <p>No captions yet.</p>
            <p className="text-xs mt-1">Click &ldquo;Auto-generate captions&rdquo; to transcribe the audio.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {segments.map((seg) => {
              const isActive = seg.id === activeSegmentId;
              return (
                <div
                  key={seg.id}
                  ref={isActive ? activeRowRef : undefined}
                  className={`rounded-md border p-3 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent/30"
                  }`}
                >
                  {/* Timestamps */}
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <button
                      className="font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Click to seek video to this caption"
                      onClick={() => seekTo(seg.startSec)}
                    >
                      <input
                        className="w-20 bg-transparent font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                        value={secToDisplay(seg.startSec)}
                        onChange={(e) =>
                          updateSegment(seg.id, "startSec", displayToSec(e.target.value))
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </button>
                    <span className="text-muted-foreground">→</span>
                    <input
                      className="w-20 bg-transparent font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                      value={secToDisplay(seg.endSec)}
                      onChange={(e) =>
                        updateSegment(seg.id, "endSec", displayToSec(e.target.value))
                      }
                    />
                    <button
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteSegment(seg.id)}
                      title="Delete caption"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Text */}
                  <textarea
                    className="w-full resize-none rounded border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                    rows={2}
                    value={seg.text}
                    onChange={(e) => updateSegment(seg.id, "text", e.target.value)}
                    placeholder="Caption text…"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
