"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RefreshCw } from "lucide-react";

interface AudioActionsProps {
  shotId: string;
  sceneId: string;
  hasMixedAudio: boolean;
  mixedAudioUrl: string | null;
  lipSyncStatus: string | null;
  hasVideo: boolean;
}

export default function AudioActions({
  shotId,
  sceneId,
  hasMixedAudio,
  mixedAudioUrl,
  lipSyncStatus,
  hasVideo,
}: AudioActionsProps) {
  const [mixing, setMixing] = useState(false);
  const [lipSyncing, setLipSyncing] = useState(false);
  const [mixResult, setMixResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lipSyncResult, setLipSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(mixedAudioUrl);
  const [currentLipSyncStatus, setCurrentLipSyncStatus] = useState(lipSyncStatus);

  async function handleMix() {
    setMixing(true);
    setMixResult(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/audio-mix`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMixResult({ success: false, message: json.error ?? "Mix failed" });
      } else {
        const { successCount, failCount } = json.data;
        setMixResult({
          success: failCount === 0,
          message: failCount === 0
            ? `Mixed ${successCount} shot(s) successfully`
            : `${successCount} succeeded, ${failCount} failed`,
        });
        // Reload page to get fresh signed URL
        if (failCount === 0) setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setMixResult({ success: false, message: "Network error" });
    } finally {
      setMixing(false);
    }
  }

  async function handleLipSync() {
    setLipSyncing(true);
    setLipSyncResult(null);
    try {
      const res = await fetch(`/api/shots/${shotId}/lip-sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setLipSyncResult({ success: false, message: json.error ?? "Lip sync failed" });
      } else {
        const status = json.data?.status ?? "UNKNOWN";
        setCurrentLipSyncStatus(status);
        if (status === "COMPLETE") {
          setLipSyncResult({ success: true, message: "Lip sync complete — reloading…" });
          setTimeout(() => window.location.reload(), 1500);
        } else if (status === "SKIPPED") {
          setLipSyncResult({ success: true, message: "Lip sync skipped (no API key configured)" });
        } else {
          setLipSyncResult({ success: false, message: json.data?.error ?? "Lip sync failed" });
        }
      }
    } catch {
      setLipSyncResult({ success: false, message: "Network error" });
    } finally {
      setLipSyncing(false);
    }
  }

  const lipSyncLabel: Record<string, string> = {
    COMPLETE: "Complete",
    FAILED: "Failed",
    SKIPPED: "Skipped (no API key)",
    PENDING: "Pending",
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Mixed audio */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Audio Mix</p>
          <p className="text-xs text-muted-foreground">
            {hasMixedAudio ? "Dialogue + music mix ready" : "Not mixed yet"}
          </p>
        </div>
        {currentAudioUrl && (
          <audio controls src={currentAudioUrl} className="h-8 max-w-xs" />
        )}
        <Button
          size="sm"
          variant={hasMixedAudio ? "outline" : "default"}
          onClick={handleMix}
          disabled={mixing}
        >
          {mixing ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : hasMixedAudio ? (
            <RefreshCw className="mr-2 h-3 w-3" />
          ) : null}
          {hasMixedAudio ? "Re-mix" : "Run Audio Mix"}
        </Button>
      </div>

      {mixResult && (
        <p className={`text-xs ${mixResult.success ? "text-green-600" : "text-destructive"}`}>
          {mixResult.message}
        </p>
      )}

      {/* Lip sync */}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <div className="flex-1">
          <p className="text-sm font-medium">Lip Sync</p>
          <p className="text-xs text-muted-foreground">
            {currentLipSyncStatus
              ? lipSyncLabel[currentLipSyncStatus] ?? currentLipSyncStatus
              : "Not run yet"}
          </p>
        </div>
        <Button
          size="sm"
          variant={currentLipSyncStatus === "COMPLETE" ? "outline" : "default"}
          onClick={handleLipSync}
          disabled={lipSyncing || !hasMixedAudio || !hasVideo}
          title={!hasMixedAudio ? "Run audio mix first" : !hasVideo ? "No video generated" : ""}
        >
          {lipSyncing ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : currentLipSyncStatus === "COMPLETE" ? (
            <RefreshCw className="mr-2 h-3 w-3" />
          ) : null}
          {currentLipSyncStatus === "COMPLETE" ? "Re-sync" : "Run Lip Sync"}
        </Button>
      </div>

      {lipSyncResult && (
        <p className={`text-xs ${lipSyncResult.success ? "text-green-600" : "text-destructive"}`}>
          {lipSyncResult.message}
        </p>
      )}
    </div>
  );
}
