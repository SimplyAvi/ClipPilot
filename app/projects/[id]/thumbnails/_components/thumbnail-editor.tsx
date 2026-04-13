"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Download,
  Image as ImageIcon,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "IMPACT_FRAME" | "CHARACTER_FOCUS" | "MOOD_ATMOSPHERE";
type FontSize = "small" | "medium" | "large";
type TextColor = "white" | "yellow" | "black" | "red";
type TextPosition = "bottom" | "center" | "top";
type TextStyle = "plain" | "bold" | "shadow" | "outline";

interface Thumbnail {
  id: string;
  variant: Variant;
  isSelected: boolean;
  youtubeR2Key: string | null;
  tiktokR2Key: string | null;
  squareR2Key: string | null;
  titleText: string | null;
  fontSize: string;
  textColor: string;
  textPosition: string;
  textStyle: string;
  prompt: string | null;
}

interface ThumbnailSignedUrls {
  id: string;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  squareUrl: string | null;
}

const VARIANT_LABELS: Record<Variant, string> = {
  IMPACT_FRAME: "Impact Frame",
  CHARACTER_FOCUS: "Character Focus",
  MOOD_ATMOSPHERE: "Mood / Atmosphere",
};

const VARIANT_DESC: Record<Variant, string> = {
  IMPACT_FRAME: "Best frame from your rendered video, color-graded for your genre",
  CHARACTER_FOCUS: "AI-generated cinematic character portrait",
  MOOD_ATMOSPHERE: "AI-generated atmospheric establishing shot",
};

const TEXT_COLOR_OPTIONS: { value: TextColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#FFFFFF" },
  { value: "yellow", label: "Yellow", swatch: "#FFD700" },
  { value: "black", label: "Black", swatch: "#000000" },
  { value: "red", label: "Red", swatch: "#FF2020" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThumbnailEditor({
  projectId,
  projectName,
  initialThumbnails,
  initialSignedUrls,
}: {
  projectId: string;
  projectName: string;
  initialThumbnails: Thumbnail[];
  initialSignedUrls: ThumbnailSignedUrls[];
}) {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>(initialThumbnails);
  const [signedUrls, setSignedUrls] = useState<ThumbnailSignedUrls[]>(initialSignedUrls);

  // Text option state (shared across preview)
  const [titleText, setTitleText] = useState(projectName);
  const [fontSize, setFontSize] = useState<FontSize>("large");
  const [textColor, setTextColor] = useState<TextColor>("white");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [textStyle, setTextStyle] = useState<TextStyle>("shadow");

  const [generating, setGenerating] = useState(false);
  const [regeneratingVariant, setRegeneratingVariant] = useState<Variant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedText, setSavedText] = useState(false);

  const selectedThumbnail = thumbnails.find((t) => t.isSelected);

  // ── Fetch fresh signed URLs ────────────────────────────────────────────────

  const refreshUrls = useCallback(async () => {
    const res = await fetch(`/api/thumbnails/${projectId}`);
    const json = await res.json();
    if (res.ok && Array.isArray(json.data)) {
      setThumbnails(json.data);
    }
  }, [projectId]);

  // ── Generate all 3 variants ───────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/thumbnails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          titleText,
          fontSize,
          textColor,
          textPosition,
          textStyle,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Generation failed");
        return;
      }
      const warns: string[] = [];
      if (json.data.noVideoWarning) warns.push(json.data.noVideoWarning);
      if (json.data.noReplicateWarning) warns.push(json.data.noReplicateWarning);
      setWarnings(warns);
      await refreshUrls();
    } catch {
      setError("Network error — could not generate thumbnails");
    } finally {
      setGenerating(false);
    }
  }, [projectId, titleText, fontSize, textColor, textPosition, textStyle, refreshUrls]);

  // ── Regenerate single variant ─────────────────────────────────────────────

  const handleRegenerate = useCallback(
    async (variant: Variant) => {
      setRegeneratingVariant(variant);
      setError(null);
      // Re-run full generation — server handles variant-by-variant upserts
      try {
        const res = await fetch("/api/thumbnails/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            titleText,
            fontSize,
            textColor,
            textPosition,
            textStyle,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          setError(json.error ?? "Regeneration failed");
          return;
        }
        await refreshUrls();
      } catch {
        setError("Network error");
      } finally {
        setRegeneratingVariant(null);
      }
    },
    [projectId, titleText, fontSize, textColor, textPosition, textStyle, refreshUrls]
  );

  // ── Select a thumbnail ─────────────────────────────────────────────────────

  const handleSelect = useCallback(
    async (thumbnailId: string) => {
      const res = await fetch(`/api/thumbnails/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailId, isSelected: true }),
      });
      if (res.ok) {
        setThumbnails((prev) =>
          prev.map((t) => ({ ...t, isSelected: t.id === thumbnailId }))
        );
      }
    },
    [projectId]
  );

  // ── Save text settings ─────────────────────────────────────────────────────

  const handleSaveText = useCallback(async () => {
    if (!selectedThumbnail) return;
    const res = await fetch(`/api/thumbnails/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thumbnailId: selectedThumbnail.id,
        titleText,
        fontSize,
        textColor,
        textPosition,
        textStyle,
      }),
    });
    if (res.ok) {
      setSavedText(true);
      setTimeout(() => setSavedText(false), 2500);
    }
  }, [projectId, selectedThumbnail, titleText, fontSize, textColor, textPosition, textStyle]);

  // ── Download ───────────────────────────────────────────────────────────────

  function download(thumbnailId: string, size: "youtube" | "tiktok" | "square") {
    window.open(
      `/api/thumbnails/${projectId}/download?thumbnailId=${thumbnailId}&size=${size}`,
      "_blank"
    );
  }

  // ── Get signed URL for a thumbnail variant ─────────────────────────────────

  function getUrl(thumbnailId: string, size: "youtube" | "tiktok" | "square"): string | null {
    const entry = signedUrls.find((u) => u.id === thumbnailId);
    if (!entry) return null;
    return size === "youtube" ? entry.youtubeUrl : size === "tiktok" ? entry.tiktokUrl : entry.squareUrl;
  }

  return (
    <div className="space-y-8">
      {/* Errors / Warnings */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {w}
        </div>
      ))}

      {/* Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Generated Thumbnails</h2>
          <p className="text-sm text-muted-foreground">3 AI-generated variants — select one to use in your export</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <ImageIcon className="mr-2 h-4 w-4" />
              {thumbnails.length > 0 ? "Regenerate All" : "Generate Thumbnails"}
            </>
          )}
        </Button>
      </div>

      {/* Thumbnail cards */}
      {thumbnails.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 text-center text-sm text-muted-foreground">
          <ImageIcon className="mb-2 h-8 w-8 opacity-30" />
          <p>No thumbnails yet — click &ldquo;Generate Thumbnails&rdquo; to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["IMPACT_FRAME", "CHARACTER_FOCUS", "MOOD_ATMOSPHERE"] as Variant[]).map(
            (variant) => {
              const thumb = thumbnails.find((t) => t.variant === variant);
              const isRegen = regeneratingVariant === variant;
              const youtubeUrl = thumb ? getUrl(thumb.id, "youtube") : null;

              return (
                <Card
                  key={variant}
                  className={`transition-all ${thumb?.isSelected ? "ring-2 ring-primary" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm">{VARIANT_LABELS[variant]}</CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">{VARIANT_DESC[variant]}</p>
                      </div>
                      {thumb?.isSelected && (
                        <Badge variant="default" className="shrink-0 text-xs">Selected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Preview image */}
                    <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                      {youtubeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={youtubeUrl}
                          alt={`${VARIANT_LABELS[variant]} thumbnail`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          {isRegen ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <ImageIcon className="h-6 w-6 opacity-30" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {thumb && (
                        <>
                          <Button
                            size="sm"
                            variant={thumb.isSelected ? "default" : "outline"}
                            className="flex-1 text-xs"
                            onClick={() => handleSelect(thumb.id)}
                            disabled={thumb.isSelected}
                          >
                            {thumb.isSelected ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Selected
                              </>
                            ) : (
                              "Select"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => handleRegenerate(variant)}
                            disabled={isRegen || generating}
                          >
                            {isRegen ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}

      {/* Text options */}
      {thumbnails.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Title Text Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Thumbnail title
              </label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Font size
                </label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as FontSize)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Text color
                </label>
                <div className="flex gap-1.5 pt-1">
                  {TEXT_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      title={opt.label}
                      onClick={() => setTextColor(opt.value)}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${
                        textColor === opt.value
                          ? "border-primary scale-110"
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: opt.swatch }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Position
                </label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={textPosition}
                  onChange={(e) => setTextPosition(e.target.value as TextPosition)}
                >
                  <option value="bottom">Bottom</option>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Style
                </label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={textStyle}
                  onChange={(e) => setTextStyle(e.target.value as TextStyle)}
                >
                  <option value="plain">Plain</option>
                  <option value="bold">Bold</option>
                  <option value="shadow">Shadow</option>
                  <option value="outline">Outline</option>
                </select>
              </div>
            </div>

            <Button size="sm" variant="outline" onClick={handleSaveText} disabled={!selectedThumbnail}>
              {savedText ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                  Saved
                </>
              ) : (
                "Save text settings"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Platform exports */}
      {selectedThumbnail && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Platform Exports</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* YouTube 16:9 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">YouTube (16:9)</CardTitle>
                <p className="text-xs text-muted-foreground">1280 × 720 px</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-md bg-muted">
                  {getUrl(selectedThumbnail.id, "youtube") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getUrl(selectedThumbnail.id, "youtube")!}
                      alt="YouTube thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => download(selectedThumbnail.id, "youtube")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download for YouTube
                </Button>
              </CardContent>
            </Card>

            {/* TikTok / Reels 9:16 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TikTok / Reels (9:16)</CardTitle>
                <p className="text-xs text-muted-foreground">1080 × 1920 px</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-[9/16] overflow-hidden rounded-md bg-muted max-h-48">
                  {getUrl(selectedThumbnail.id, "tiktok") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getUrl(selectedThumbnail.id, "tiktok")!}
                      alt="TikTok thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => download(selectedThumbnail.id, "tiktok")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download for TikTok / Reels
                </Button>
              </CardContent>
            </Card>

            {/* Square 1:1 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Square (1:1)</CardTitle>
                <p className="text-xs text-muted-foreground">1080 × 1080 px</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-square overflow-hidden rounded-md bg-muted">
                  {getUrl(selectedThumbnail.id, "square") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getUrl(selectedThumbnail.id, "square")!}
                      alt="Square thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => download(selectedThumbnail.id, "square")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download Square
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
