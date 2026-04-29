"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { AssignCharacterModal } from "./assign-character-modal";
import { AlertTriangle, Check, Loader2, Play, Wand2 } from "lucide-react";

type CharacterFormData = {
  id?: string;
  name: string;
  role: string | null;
  age: number | null;
  gender: string | null;
  ethnicity: string | null;
  physicalDescription: string | null;
  biography: string | null;
  personality: string | null;
  motivations: string | null;
  fears: string | null;
  quirks: string | null;
  emotionalRange: string | null;
  gestureTendencies: string | null;
  forbiddenChanges: string | null;
  portraitPath: string | null;
  portraitPrompt: string | null;
  portraitStyle: string | null;
  voiceId: string | null;
  voicePace: string | null;
  voiceAccent: string | null;
  voiceTone: string | null;
  voiceNotes: string | null;
  tags: string | null;
};

type Voice = { voice_id: string; name: string; category: string };

const blankCharacter: CharacterFormData = {
  name: "",
  role: "Protagonist",
  age: 30,
  gender: "Unspecified",
  ethnicity: "",
  physicalDescription: "",
  biography: "",
  personality: "",
  motivations: "",
  fears: "",
  quirks: "",
  emotionalRange: "moderate",
  gestureTendencies: "",
  forbiddenChanges: "",
  portraitPath: null,
  portraitPrompt: null,
  portraitStyle: "cinematic-realistic",
  voiceId: null,
  voicePace: "normal",
  voiceAccent: "",
  voiceTone: "",
  voiceNotes: "",
  tags: "",
};

export function CharacterForm({
  initialCharacter,
  defaultProjectId = null,
}: {
  initialCharacter?: CharacterFormData;
  defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CharacterFormData>(initialCharacter ?? blankCharacter);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [generating, setGenerating] = useState(false);
  const [portraitOptions, setPortraitOptions] = useState<Array<{ url: string | null; flagged: boolean; message: string | null }>>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/elevenlabs/voices")
      .then((res) => res.json())
      .then((json) => setVoices(json.data ?? []))
      .catch(() => setVoices([]));
  }, []);

  function update<K extends keyof CharacterFormData>(key: K, value: CharacterFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCharacter() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(form.id ? `/api/characters/${form.id}` : "/api/characters", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          projectId: form.id ? undefined : defaultProjectId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setForm((current) => ({ ...current, id: json.data.id }));
      setSaved(true);
      router.refresh();
      return json.data.id as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndCast() {
    const id = await saveCharacter();
    if (id) setAssignOpen(true);
  }

  async function generatePortrait() {
    const id = form.id ?? (await saveCharacter());
    if (!id) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/characters/generate-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: id,
          physicalDescription: form.physicalDescription,
          age: form.age,
          gender: form.gender,
          ethnicity: form.ethnicity || "unspecified ethnicity",
          style: form.portraitStyle,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Portrait generation failed");
      update("portraitPrompt", json.data.prompt);
      setPortraitOptions(json.data.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portrait generation failed. Try adjusting the physical description and regenerating.");
    } finally {
      setGenerating(false);
    }
  }

  async function selectPortrait(url: string) {
    if (!form.id) return;
    const res = await fetch(`/api/characters/${form.id}/set-portrait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portraitUrl: url, portraitPrompt: form.portraitPrompt ?? "" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not save portrait");
      return;
    }
    update("portraitPath", json.data.portraitPath);
    router.refresh();
  }

  async function previewVoice() {
    if (!form.voiceId) return;
    const res = await fetch("/api/characters/preview-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: form.voiceId, speakingPace: form.voicePace ?? "normal", emotionalRange: form.emotionalRange ?? "moderate" }),
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    audioRef.current = new Audio(url);
    audioRef.current.play();
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <PortraitFrame src={form.portraitPath} alt={form.name || "Character portrait"} size="full" />
          <div className="grid grid-cols-2 gap-2">
            {["cinematic-realistic", "stylized", "illustrated", "noir"].map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update("portraitStyle", style)}
                className={`rounded-lg border p-3 text-left text-sm capitalize ${form.portraitStyle === style ? "border-primary bg-accent" : ""}`}
              >
                {style.replace("-", " ")}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={generatePortrait} disabled={generating || !form.physicalDescription || !form.name}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate Portrait
          </Button>
          {generating && <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />}
          {portraitOptions.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {portraitOptions.map((option, index) => (
                <button
                  key={`${option.url}-${index}`}
                  type="button"
                  disabled={!option.url}
                  onClick={() => option.url && selectPortrait(option.url)}
                  className="rounded-lg text-left disabled:cursor-not-allowed"
                >
                  {option.url ? (
                    <PortraitFrame src={option.url} alt={`Portrait option ${index + 1}`} size="sm" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-lg border bg-amber-50 p-2 text-center text-xs text-amber-800">
                      Portrait flagged - regenerate or adjust description
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic Identity</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
              <Field label="Role">
                <Select value={form.role ?? ""} onValueChange={(value) => update("role", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Protagonist", "Antagonist", "Supporting", "Minor", "Narrator"].map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Age"><Input type="number" min={5} max={100} value={form.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Gender">
                <Select value={form.gender ?? ""} onValueChange={(value) => update("gender", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Man", "Woman", "Non-binary", "Unspecified"].map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ethnicity"><Input value={form.ethnicity ?? ""} onChange={(e) => update("ethnicity", e.target.value)} /></Field>
              <Field label="Tags"><Input value={form.tags ?? ""} onChange={(e) => update("tags", e.target.value)} placeholder="thriller, hero, detective" /></Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Physical Appearance</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Portrait Generation Notice</div>
              All character portraits are AI-generated from your description. Do not describe real, living, or deceased people, celebrities, public figures, or any person whose likeness you do not own. Every generated portrait is automatically scanned for resemblance to known public figures before being shown to you.
            </div>
            <Field label="Physical Description">
              <Textarea rows={6} value={form.physicalDescription ?? ""} onChange={(e) => update("physicalDescription", e.target.value)} placeholder="Tall and lean with a weathered face, deep-set dark brown eyes..." />
              <p className="mt-1 text-xs text-muted-foreground">Describe what this character looks like. Be specific. This text is used to generate their portrait.</p>
            </Field>
            <Field label="Forbidden Changes">
              <Textarea rows={3} value={form.forbiddenChanges ?? ""} onChange={(e) => update("forbiddenChanges", e.target.value)} placeholder="Scar on left cheek must always be visible, eye color..." />
            </Field>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personality & Background</h2>
            <Field label="Personality"><Textarea rows={3} value={form.personality ?? ""} onChange={(e) => update("personality", e.target.value)} /></Field>
            <Field label="Biography / Backstory"><Textarea rows={6} value={form.biography ?? ""} onChange={(e) => update("biography", e.target.value)} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Motivations"><Textarea rows={3} value={form.motivations ?? ""} onChange={(e) => update("motivations", e.target.value)} /></Field>
              <Field label="Fears"><Textarea rows={3} value={form.fears ?? ""} onChange={(e) => update("fears", e.target.value)} /></Field>
              <Field label="Quirks"><Textarea rows={3} value={form.quirks ?? ""} onChange={(e) => update("quirks", e.target.value)} /></Field>
              <Field label="Gesture Tendencies"><Textarea rows={3} value={form.gestureTendencies ?? ""} onChange={(e) => update("gestureTendencies", e.target.value)} /></Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Voice</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ElevenLabs Voice">
                <Select value={form.voiceId ?? ""} onValueChange={(value) => update("voiceId", value)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{voices.map((voice) => <SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Pace">
                <Select value={form.voicePace ?? "normal"} onValueChange={(value) => update("voicePace", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["slow", "normal", "fast"].map((pace) => <SelectItem key={pace} value={pace}>{pace}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Accent"><Input value={form.voiceAccent ?? ""} onChange={(e) => update("voiceAccent", e.target.value)} /></Field>
              <Field label="Tone"><Input value={form.voiceTone ?? ""} onChange={(e) => update("voiceTone", e.target.value)} /></Field>
            </div>
            <Field label="Voice Notes"><Textarea rows={3} value={form.voiceNotes ?? ""} onChange={(e) => update("voiceNotes", e.target.value)} /></Field>
            <Button variant="outline" type="button" disabled={!form.voiceId} title={!form.voiceId ? "Assign a voice first" : undefined} onClick={previewVoice}>
              <Play className="mr-2 h-4 w-4" />Preview Voice
            </Button>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="flex items-center gap-1 text-sm text-green-600"><Check className="h-4 w-4" />Saved</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveAndCast} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save & Cast in Project</Button>
              <Button onClick={saveCharacter} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Character</Button>
            </div>
          </div>
        </div>
      </div>

      {form.id && (
        <AssignCharacterModal
          open={assignOpen}
          onOpenChange={setAssignOpen}
          character={{ id: form.id, name: form.name, portraitPath: form.portraitPath }}
          defaultProjectId={defaultProjectId}
          onAssigned={() => router.refresh()}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
