"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";

// ─── Option lists ─────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "MUSIC", label: "Music" },
  { value: "VOICE", label: "Voice" },
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video Footage" },
  { value: "AI_GENERATED", label: "AI Generated" },
  { value: "FOOTAGE", label: "Stock Footage" },
  { value: "AUDIO", label: "Audio / SFX" },
];

const LICENSE_TYPES = [
  { value: "CC0", label: "CC0 (Public Domain)" },
  { value: "CC_BY", label: "CC BY (Attribution)" },
  { value: "CC_BY_SA", label: "CC BY-SA (Share-Alike)" },
  { value: "CC_BY_NC", label: "CC BY-NC (Non-Commercial)" },
  { value: "PIXABAY", label: "Pixabay License" },
  { value: "ROYALTY_FREE", label: "Royalty-Free" },
  { value: "ELEVENLABS_COMMERCIAL", label: "ElevenLabs Commercial" },
  { value: "RUNWAY_COMMERCIAL", label: "Runway Commercial" },
  { value: "LICENSED", label: "Custom / Purchased" },
  { value: "GENERATED", label: "AI Generated" },
  { value: "UNKNOWN", label: "Unknown — needs verification" },
];

const TRISTATE_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
  { value: "null", label: "Unknown" },
];

type ContentIdState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "clear"; message: string }
  | { status: "risk"; track: string; message: string }
  | { status: "error"; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewAssetPage() {
  const router = useRouter();
  const licenseFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [licenseScreenshotFile, setLicenseScreenshotFile] = useState<File | null>(null);
  const [commercialUse, setCommercialUse] = useState("null");
  const [monetizationAllowed, setMonetizationAllowed] = useState("null");
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [attributionText, setAttributionText] = useState("");
  const [notes, setNotes] = useState("");

  // Content ID state
  const [contentIdState, setContentIdState] = useState<ContentIdState>({ status: "idle" });
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Submit state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Content ID check ─────────────────────────────────────────────────────

  async function handleContentIdCheck() {
    if (!audioFile) return;
    setContentIdState({ status: "checking" });

    try {
      const fd = new FormData();
      fd.append("file", audioFile);

      const res = await fetch("/api/assets/check-content-id", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok || json.error) {
        setContentIdState({ status: "error", message: json.error ?? "Check failed" });
        return;
      }

      const result = json.data;
      if (result.clear) {
        setContentIdState({ status: "clear", message: result.message });
      } else {
        setContentIdState({
          status: "risk",
          track: result.track ? `"${result.track.title}" by ${result.track.artist}` : "Unknown",
          message: result.message,
        });
      }
    } catch {
      setContentIdState({ status: "error", message: "Network error during Content ID check." });
    }
  }

  // ── Form submission ──────────────────────────────────────────────────────

  function tristateToBool(val: string): boolean | null {
    if (val === "true") return true;
    if (val === "false") return false;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!type) { setError("Please select an asset type."); return; }
    if (!licenseType) { setError("Please select a license type."); return; }

    setLoading(true);

    try {
      // Derive Content ID fields from the check result
      const contentIdChecked = contentIdState.status === "clear" || contentIdState.status === "risk";
      const contentIdClear = contentIdState.status === "clear";

      const payload = {
        name,
        type,
        sourceName,
        sourceUrl: sourceUrl || undefined,
        licenseType,
        licenseUrl: licenseUrl || undefined,
        commercialUse: tristateToBool(commercialUse),
        monetizationAllowed: tristateToBool(monetizationAllowed),
        attributionRequired,
        attributionText: attributionRequired ? attributionText : undefined,
        notes: notes || undefined,
        // contentIdChecked / contentIdClear go via PATCH after create,
        // because the create endpoint doesn't accept them directly
      };

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to save asset.");
        return;
      }

      const assetId: string = json.data.id;

      // Patch Content ID flags if a check was run
      if (contentIdChecked) {
        await fetch(`/api/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentIdChecked, contentIdClear }),
        });
      }

      router.push("/assets");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add Asset</h1>
        <p className="mt-1 text-muted-foreground">
          Every asset needs a verified license before it can be used in generation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ── Core details ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Uplifting Corporate Beat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Asset Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-name">Source Name *</Label>
              <Input
                id="source-name"
                placeholder="e.g. Pixabay, ElevenLabs"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="source-url">Source URL</Label>
              <Input
                id="source-url"
                type="url"
                placeholder="https://pixabay.com/music/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── License ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">License Information</CardTitle>
            <CardDescription>
              Be precise. If you&apos;re unsure, set to &quot;Unknown&quot; — the asset will be flagged for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label>License Type *</Label>
              <Select value={licenseType} onValueChange={setLicenseType}>
                <SelectTrigger><SelectValue placeholder="Select license" /></SelectTrigger>
                <SelectContent>
                  {LICENSE_TYPES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="license-url">License Page URL</Label>
              <Input
                id="license-url"
                type="url"
                placeholder="https://pixabay.com/service/license-summary/"
                value={licenseUrl}
                onChange={(e) => setLicenseUrl(e.target.value)}
              />
            </div>

            {/* License screenshot */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label>License Screenshot (optional)</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={licenseFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setLicenseScreenshotFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => licenseFileRef.current?.click()}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  Upload Screenshot
                </Button>
                {licenseScreenshotFile && (
                  <span className="text-xs text-muted-foreground">{licenseScreenshotFile.name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Screenshot storage (Cloudflare R2) coming in a later phase. The filename will be recorded.
              </p>
            </div>

            {/* Commercial use */}
            <div className="flex flex-col gap-1.5">
              <Label>Commercial Use Allowed?</Label>
              <Select value={commercialUse} onValueChange={setCommercialUse}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRISTATE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monetization */}
            <div className="flex flex-col gap-1.5">
              <Label>Monetized Content Allowed?</Label>
              <Select value={monetizationAllowed} onValueChange={setMonetizationAllowed}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRISTATE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attribution */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <Checkbox
                id="attribution"
                checked={attributionRequired}
                onCheckedChange={(v) => setAttributionRequired(!!v)}
              />
              <Label htmlFor="attribution" className="cursor-pointer">
                Attribution required
              </Label>
            </div>

            {attributionRequired && (
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="attribution-text">Attribution Text</Label>
                <Input
                  id="attribution-text"
                  placeholder='e.g. "Track Name" by Artist (Pixabay)'
                  value={attributionText}
                  onChange={(e) => setAttributionText(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Content ID (music only) ── */}
        {(type === "MUSIC" || type === "AUDIO") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content ID Pre-Check</CardTitle>
              <CardDescription>
                Upload the audio file to check if it&apos;s fingerprinted in the AudD database.
                Recognized tracks are a Content ID risk and must not be used.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <input
                  ref={audioFileRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,audio/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => audioFileRef.current?.click()}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {audioFile ? "Replace Audio File" : "Upload Audio File"}
                </Button>
                {audioFile && (
                  <span className="text-xs text-muted-foreground">{audioFile.name}</span>
                )}
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleContentIdCheck}
                disabled={!audioFile || contentIdState.status === "checking"}
              >
                {contentIdState.status === "checking" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</>
                ) : (
                  "Check Content ID"
                )}
              </Button>

              {/* Result */}
              {contentIdState.status === "clear" && (
                <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {contentIdState.message}
                </div>
              )}
              {contentIdState.status === "risk" && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Content ID Risk — Do Not Use</p>
                    <p>{contentIdState.track}</p>
                  </div>
                </div>
              )}
              {contentIdState.status === "error" && (
                <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {contentIdState.message}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Notes ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional context about this asset or its license…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
            />
          </CardContent>
        </Card>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/assets")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              "Save Asset"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
