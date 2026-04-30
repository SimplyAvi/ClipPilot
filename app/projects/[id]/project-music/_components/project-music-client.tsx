"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type Segment = { id: string; emotionalQuality: string | null; sortOrder: number };
type Track = {
  mood: string | null;
  tempo: string | null;
  style: string | null;
  primaryInstrument: string | null;
  silenceUsage: string | null;
  emotionalArc: string | null;
  audioPath: string | null;
  generationPrompt: string | null;
  status: string;
};

export function ProjectMusicClient({ projectId, initialTrack, segments, audioUrl }: { projectId: string; initialTrack: Track; segments: Segment[]; audioUrl: string | null }) {
  const [track, setTrack] = useState(initialTrack);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(audioUrl);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(() => segments.map((segment, index) => ({ x: index, y: scoreEmotion(segment.emotionalQuality) })), [segments]);

  async function saveTrack() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/music-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...track }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save music settings");
      setTrack(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save music settings");
    } finally {
      setSaving(false);
    }
  }

  async function generateMusic() {
    await saveTrack();
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate music");
      setTrack(json.data.track);
      setCurrentAudioUrl(json.data.audioUrl ?? null);
      setMessage(json.data.message ?? "Music request saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate music");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Score the Poem</h1>
        <p className="mt-1 text-muted-foreground">The music is generated to follow the emotional journey of your words.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Emotional Arc Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg border bg-muted/30 p-4">
            <svg viewBox="0 0 500 160" className="h-full w-full">
              <line x1="30" y1="10" x2="30" y2="135" stroke="currentColor" opacity="0.25" />
              <line x1="30" y1="135" x2="480" y2="135" stroke="currentColor" opacity="0.25" />
              {points.map((point, index) => {
                const x = 45 + (point.x / Math.max(points.length - 1, 1)) * 410;
                const y = 135 - point.y * 24;
                return <circle key={index} cx={x} cy={y} r="5" className="fill-primary" />;
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Music Style</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Style"><Input value={track.style ?? ""} onChange={(event) => setTrack((current) => ({ ...current, style: event.target.value }))} /></Field>
          <Field label="Primary Instrument"><Input value={track.primaryInstrument ?? ""} onChange={(event) => setTrack((current) => ({ ...current, primaryInstrument: event.target.value }))} placeholder="piano, strings, ambient synth" /></Field>
          <Field label="Mood"><Input value={track.mood ?? ""} onChange={(event) => setTrack((current) => ({ ...current, mood: event.target.value }))} /></Field>
          <Field label="Tempo">
            <Select value={track.tempo ?? "Atmospheric"} onValueChange={(tempo) => setTrack((current) => ({ ...current, tempo }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Slow", "Medium", "Atmospheric"].map((tempo) => <SelectItem key={tempo} value={tempo}>{tempo}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Silence Usage">
            <Select value={track.silenceUsage ?? "Moderate"} onValueChange={(silenceUsage) => setTrack((current) => ({ ...current, silenceUsage }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Heavy", "Moderate", "Continuous"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Emotional Arc"><Textarea rows={4} value={track.emotionalArc ?? ""} onChange={(event) => setTrack((current) => ({ ...current, emotionalArc: event.target.value }))} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Generation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateMusic} disabled={generating || saving}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Music Track
          </Button>
          {currentAudioUrl && <audio src={currentAudioUrl} controls className="w-full" />}
          {message && <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
          {track.status === "manual_upload_needed" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              No music generation API connected. Upload a royalty-free track from your Asset Library instead.
              <Button className="ml-3" size="sm" variant="outline" asChild><Link href="/assets?type=MUSIC">Open Music Assets</Link></Button>
            </div>
          )}
          {track.status === "provider_ready" && !currentAudioUrl && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
              Your music provider is connected, and the score prompt has been prepared. This page does not yet render a finished
              track from the provider, so use the royalty-free Asset Library for the final music file until provider rendering is
              wired in.
              <Button className="ml-3" size="sm" variant="outline" asChild><Link href="/assets?type=MUSIC">Open Music Assets</Link></Button>
            </div>
          )}
          {track.status === "failed" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Music generation failed. Check your Mubert credentials and that Text-to-Music is enabled on your Mubert API plan.
            </div>
          )}
          {track.generationPrompt && <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{track.generationPrompt}</pre>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function scoreEmotion(value: string | null) {
  const text = value?.toLowerCase() ?? "";
  if (/devastat|terr|climax|panic|rage|ecstatic|overwhelm/.test(text)) return 5;
  if (/tense|yearn|grief|awe|urgent|pain/.test(text)) return 4;
  if (/melanch|hope|warm|intimate|wonder/.test(text)) return 3;
  if (/quiet|soft|calm|still/.test(text)) return 2;
  return 1;
}
