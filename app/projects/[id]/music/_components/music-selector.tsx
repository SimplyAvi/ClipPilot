"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Music, CheckCircle2, XCircle, Loader2, ExternalLink, Volume2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  name: string;
  sourceName: string;
  sourceUrl: string | null;
  licenseType: string;
  commercialUse: boolean | null;
  contentIdChecked: boolean;
  contentIdClear: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
}

interface MusicCue {
  id: string;
  assetId: string;
  startPointSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  volumeDb: number;
  asset: Asset;
}

interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  musicCue: MusicCue | null;
}

interface MusicSelectorProps {
  projectId: string;
  scenes: Scene[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearanceColor(asset: Asset): "green" | "yellow" | "red" {
  if (asset.commercialUse === false) return "red";
  if (asset.contentIdChecked && !asset.contentIdClear) return "red";
  if (asset.commercialUse === true && (!asset.contentIdChecked || asset.contentIdClear)) return "green";
  return "yellow";
}

function ClearanceBadge({ asset }: { asset: Asset }) {
  const color = clearanceColor(asset);
  const variants = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  } as const;
  const labels = { green: "Clear", yellow: "Unverified", red: "Blocked" };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${variants[color]}`}>
      {labels[color]}
    </span>
  );
}

// ─── Scene Music Card ─────────────────────────────────────────────────────────

function SceneMusicCard({
  scene,
  assets,
  onCueSaved,
}: {
  scene: Scene;
  assets: Asset[];
  onCueSaved: (sceneId: string, cue: MusicCue | null) => void;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(scene.musicCue?.assetId ?? "");
  const [startPointSec, setStartPointSec] = useState(scene.musicCue?.startPointSec ?? 0);
  const [fadeInSec, setFadeInSec] = useState(scene.musicCue?.fadeInSec ?? 2);
  const [fadeOutSec, setFadeOutSec] = useState(scene.musicCue?.fadeOutSec ?? 3);
  const [volumeDb, setVolumeDb] = useState(scene.musicCue?.volumeDb ?? -12);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const clearableAssets = assets.filter((a) => clearanceColor(a) !== "red");

  async function handleSave() {
    if (!selectedAssetId) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scenes/${scene.id}/music-cue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selectedAssetId, startPointSec, fadeInSec, fadeOutSec, volumeDb }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error ?? "Save failed" });
      } else {
        setMessage({ type: "success", text: "Music cue saved" });
        onCueSaved(scene.id, json.data);
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scenes/${scene.id}/music-cue`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setMessage({ type: "error", text: json.error ?? "Remove failed" });
      } else {
        setSelectedAssetId("");
        setMessage({ type: "success", text: "Music cue removed" });
        onCueSaved(scene.id, null);
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setRemoving(false);
    }
  }

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            Scene {scene.sceneNumber} — {scene.title}
          </span>
          {scene.musicCue ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />
              {scene.musicCue.asset.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No music
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Asset picker */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Music track</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
          >
            <option value="">— None —</option>
            {clearableAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.sourceName})
              </option>
            ))}
          </select>
        </div>

        {selectedAsset && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ClearanceBadge asset={selectedAsset} />
            <span>{selectedAsset.licenseType.replace(/_/g, " ")}</span>
            {selectedAsset.attributionRequired && (
              <span className="text-amber-600">Attribution required</span>
            )}
            {selectedAsset.sourceUrl && (
              <a
                href={selectedAsset.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Controls */}
        {selectedAssetId && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Start (sec)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={startPointSec}
                onChange={(e) => setStartPointSec(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Fade In (sec)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={fadeInSec}
                onChange={(e) => setFadeInSec(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Fade Out (sec)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={fadeOutSec}
                onChange={(e) => setFadeOutSec(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Volume (dB)
              </label>
              <input
                type="number"
                min="-40"
                max="0"
                step="1"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={volumeDb}
                onChange={(e) => setVolumeDb(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {message && (
          <p className={`text-xs ${message.type === "error" ? "text-destructive" : "text-green-600"}`}>
            {message.text}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!selectedAssetId || saving}
          >
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save cue
          </Button>
          {scene.musicCue && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MusicSelector({ projectId, scenes: initialScenes }: MusicSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [loadingAssets, setLoadingAssets] = useState(true);

  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch(`/api/assets?type=MUSIC`);
        const json = await res.json();
        if (json.data) setAssets(json.data);
      } catch {
        // non-blocking
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
  }, []);

  const handleCueSaved = useCallback((sceneId: string, cue: MusicCue | null) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, musicCue: cue } : s))
    );
  }, []);

  if (loadingAssets) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading music library…
      </div>
    );
  }

  const musicAssets = assets; // already filtered to MUSIC type by API query param
  const clearableCount = musicAssets.filter((a) => clearanceColor(a) !== "red").length;

  return (
    <div className="space-y-6">
      {/* Library summary */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
        <Music className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">{clearableCount}</span> cleared tracks available from{" "}
          <span className="font-medium">{musicAssets.length}</span> in library
        </div>
        {clearableCount === 0 && (
          <Badge variant="destructive" className="ml-auto text-xs">
            No cleared music
          </Badge>
        )}
      </div>

      {/* Per-scene cue cards */}
      <div className="space-y-4">
        {scenes.map((scene) => (
          <SceneMusicCard
            key={scene.id}
            scene={scene}
            assets={musicAssets}
            onCueSaved={handleCueSaved}
          />
        ))}
      </div>

      {scenes.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No scenes found. Generate video first to create scenes.
        </p>
      )}
    </div>
  );
}
