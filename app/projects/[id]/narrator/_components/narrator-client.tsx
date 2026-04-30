"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play } from "lucide-react";

type Voice = { voice_id: string; name: string; preview_url: string | null; labels?: Record<string, string> };
type Segment = { id: string; stanzaText: string; sortOrder: number };
type Profile = {
  voiceId: string | null;
  voiceName: string | null;
  gender: string | null;
  pace: string;
  tone: string | null;
  emotionalRange: string;
  deliveryStyle: string | null;
  pauseSeconds: number;
  previewAudioPath: string | null;
};

export function NarratorClient({ projectId, profile: initialProfile, segments, previewUrl }: { projectId: string; profile: Profile; segments: Segment[]; previewUrl: string | null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState(segments[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [audioUrl, setAudioUrl] = useState(previewUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/elevenlabs/voices")
      .then((res) => res.json())
      .then((json) => setVoices(json.data ?? []))
      .catch(() => setVoices([]));
  }, []);

  const filteredVoices = useMemo(() => {
    const gender = profile.gender?.toLowerCase();
    if (!gender || gender === "gender neutral") return voices.slice(0, 5);
    return voices.filter((voice) => Object.values(voice.labels ?? {}).join(" ").toLowerCase().includes(gender)).slice(0, 5);
  }, [profile.gender, voices]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/narrator-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...profile }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save narrator");
      setProfile(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save narrator");
    } finally {
      setSaving(false);
    }
  }

  async function generatePreview() {
    await saveProfile();
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/visual-narrator/generate-narrator-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, previewSegmentId: selectedSegmentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate preview");
      const path = json.data.generated?.[0]?.path;
      if (path) setAudioUrl(`/api/storage/view?key=${encodeURIComponent(path)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate preview");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configure the Narrator Voice</h1>
        <p className="mt-1 text-muted-foreground">The narrator reads your script aloud while the visuals play. No face is shown, just the voice.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Voice Selection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["Man", "Woman", "Gender Neutral"].map((gender) => (
              <Button key={gender} type="button" variant={profile.gender === gender ? "default" : "outline"} onClick={() => setProfile((current) => ({ ...current, gender }))}>{gender}</Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {filteredVoices.map((voice) => (
              <button key={voice.voice_id} type="button" onClick={() => setProfile((current) => ({ ...current, voiceId: voice.voice_id, voiceName: voice.name }))} className={`rounded-lg border p-4 text-left ${profile.voiceId === voice.voice_id ? "border-primary bg-primary/5" : ""}`}>
                <p className="font-medium">{voice.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{Object.values(voice.labels ?? {}).join(", ") || "Voice profile"}</p>
                {voice.preview_url && <audio src={voice.preview_url} controls className="mt-3 w-full" />}
              </button>
            ))}
          </div>
          {voices.length === 0 && <p className="text-sm text-muted-foreground">Connect ElevenLabs in Settings to load narrator voices.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Delivery Settings</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Reading Pace">
            <Select value={profile.pace} onValueChange={(pace) => setProfile((current) => ({ ...current, pace }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">Slow - contemplative</SelectItem>
                <SelectItem value="measured">Measured - deliberate</SelectItem>
                <SelectItem value="moderate">Moderate - storytelling</SelectItem>
                <SelectItem value="expressive">Expressive - dynamic</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pause Between Stanzas">
            <Select value={String(profile.pauseSeconds)} onValueChange={(value) => setProfile((current) => ({ ...current, pauseSeconds: Number(value) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[0.5, 1, 1.5, 2].map((value) => <SelectItem key={value} value={String(value)}>{value}s{value === 2 ? " - recommended for poetry" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Emotional Range">
            <Input value={profile.emotionalRange} onChange={(event) => setProfile((current) => ({ ...current, emotionalRange: event.target.value }))} />
          </Field>
          <Field label="Tone">
            <Input value={profile.tone ?? ""} onChange={(event) => setProfile((current) => ({ ...current, tone: event.target.value }))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Emotional Delivery">
              <Textarea rows={4} value={profile.deliveryStyle ?? ""} onChange={(event) => setProfile((current) => ({ ...current, deliveryStyle: event.target.value }))} placeholder="quiet and introspective, as if remembering something painful but accepting it" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Voice Preview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger><SelectValue placeholder="Choose a stanza" /></SelectTrigger>
            <SelectContent>{segments.map((segment) => <SelectItem key={segment.id} value={segment.id}>Segment {segment.sortOrder + 1}: {segment.stanzaText.slice(0, 60)}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={generatePreview} disabled={!profile.voiceId || previewing}>
            {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Generate Preview
          </Button>
          {audioUrl && <audio src={audioUrl} controls className="w-full" />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Preview looks good"}</Button>
            <Button variant="outline" asChild><Link href={`/projects/${projectId}/visual-storyboard`}>Back to Storyboard</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
