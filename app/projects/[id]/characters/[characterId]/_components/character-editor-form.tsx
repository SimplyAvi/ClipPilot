"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mic, Play, AlertTriangle, Check } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export interface CharacterData {
  id: string;
  projectId: string;
  name: string;
  ageAppearance: number | null;
  description: string | null;
  personalityNotes: string | null;
  elevenLabsVoiceId: string | null;
  voiceName: string | null;
  speakingPace: string;
  emotionalRange: string;
  accent: string | null;
  confirmedFictional: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CharacterEditorForm({
  character,
  projectId,
}: {
  character: CharacterData;
  projectId: string;
}) {
  const router = useRouter();

  // ── Form state ──
  const [confirmedFictional, setConfirmedFictional] = useState(character.confirmedFictional);
  const [ageAppearance, setAgeAppearance] = useState<number>(character.ageAppearance ?? 30);
  const [ageEnabled, setAgeEnabled] = useState(character.ageAppearance !== null);
  const [description, setDescription] = useState(character.description ?? "");
  const [personalityNotes, setPersonalityNotes] = useState(character.personalityNotes ?? "");
  const [voiceId, setVoiceId] = useState(character.elevenLabsVoiceId ?? "");
  const [voiceName, setVoiceName] = useState(character.voiceName ?? "");
  const [speakingPace, setSpeakingPace] = useState(character.speakingPace);
  const [emotionalRange, setEmotionalRange] = useState(character.emotionalRange);
  const [accent, setAccent] = useState(character.accent ?? "");

  // ── Voices ──
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  // ── Preview ──
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // ── Save ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Fetch voices on mount ──
  useEffect(() => {
    fetch("/api/elevenlabs/voices")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setVoices(json.data);
        else setVoicesError(json.error ?? "Failed to load voices");
      })
      .catch(() => setVoicesError("Failed to load voices"))
      .finally(() => setVoicesLoading(false));
  }, []);

  // ── Clean up blob URL on unmount ──
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // ── Voice preview ──
  async function handlePreview() {
    if (!voiceId) return;
    setPreviewing(true);
    setPreviewError(null);

    try {
      const res = await fetch("/api/characters/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, speakingPace, emotionalRange }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      audioRef.current.play();
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload: Record<string, unknown> = {
      confirmedFictional,
      ageAppearance: ageEnabled ? ageAppearance : null,
      description: description || null,
      personalityNotes: personalityNotes || null,
      elevenLabsVoiceId: voiceId || null,
      voiceName: voiceName || null,
      speakingPace,
      emotionalRange,
      accent: accent || null,
    };

    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers ──
  function handleVoiceSelect(selectedId: string) {
    setVoiceId(selectedId);
    const match = voices.find((v) => v.voice_id === selectedId);
    setVoiceName(match?.name ?? "");
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Compliance section ── */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Compliance Requirement</p>
        </div>
        <p className="mb-4 text-sm text-amber-700">
          This character will be used to generate AI voice audio. You must confirm that{" "}
          <strong>{character.name}</strong> is an entirely fictional character that does not
          represent a real, living, or deceased person. Using a real person&apos;s likeness for
          AI-generated content without consent may violate platform policies and applicable law.
        </p>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={confirmedFictional}
            onCheckedChange={(v) => setConfirmedFictional(Boolean(v))}
            className="mt-0.5"
          />
          <span className="text-sm font-medium text-amber-900">
            I confirm that {character.name} is a fictional character and not based on any real
            person.
          </span>
        </label>
      </section>

      {/* ── Identity section ── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Identity
        </h2>

        <div className="flex flex-col gap-5">
          {/* Age appearance */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Apparent Age</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={ageEnabled}
                  onChange={(e) => setAgeEnabled(e.target.checked)}
                  className="rounded border"
                />
                Set age
              </label>
            </div>
            {ageEnabled ? (
              <div className="flex items-center gap-4">
                <Slider
                  min={18}
                  max={80}
                  step={1}
                  value={ageAppearance}
                  onValueChange={setAgeAppearance}
                  className="flex-1"
                />
                <span className="w-8 text-right text-sm font-medium tabular-nums">
                  {ageAppearance}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Age not specified</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Used to guide image generation. Must be 18–80.
            </p>
          </div>

          {/* Physical description */}
          <div>
            <Label htmlFor="description" className="mb-1.5 block">
              Physical Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe physical appearance for image generation prompts…"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Personality notes */}
          <div>
            <Label htmlFor="personality" className="mb-1.5 block">
              Personality & Dialogue Notes
            </Label>
            <Textarea
              id="personality"
              value={personalityNotes}
              onChange={(e) => setPersonalityNotes(e.target.value)}
              placeholder="Notes on personality, speech patterns, and how they deliver dialogue…"
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>
      </section>

      {/* ── Voice section ── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Voice Configuration
        </h2>

        <div className="flex flex-col gap-5">
          {/* Voice selector */}
          <div>
            <Label className="mb-1.5 block">ElevenLabs Voice</Label>
            {voicesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading voices…
              </div>
            ) : voicesError ? (
              <p className="text-sm text-destructive">{voicesError}</p>
            ) : (
              <Select value={voiceId} onValueChange={handleVoiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice…" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.voice_id} value={v.voice_id}>
                      <span className="flex items-center gap-2">
                        {v.name}
                        {v.category === "premade" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Premade
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Speaking pace */}
          <div>
            <Label className="mb-1.5 block">Speaking Pace</Label>
            <Select value={speakingPace} onValueChange={setSpeakingPace}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">Slow</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Emotional range */}
          <div>
            <Label className="mb-1.5 block">Emotional Range</Label>
            <Select value={emotionalRange} onValueChange={setEmotionalRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restrained">Restrained — calm, measured delivery</SelectItem>
                <SelectItem value="moderate">Moderate — balanced expressiveness</SelectItem>
                <SelectItem value="expressive">Expressive — dynamic, emotional delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Accent */}
          <div>
            <Label htmlFor="accent" className="mb-1.5 block">
              Accent / Regional Note
            </Label>
            <Input
              id="accent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="e.g. British RP, Southern US, Australian…"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Informational only — accent is determined by the chosen ElevenLabs voice.
            </p>
          </div>

          {/* Preview button */}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={!voiceId || previewing}
            >
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Preview Voice
              <Mic className="ml-2 h-4 w-4 text-muted-foreground" />
            </Button>
            {!voiceId && (
              <p className="mt-1 text-xs text-muted-foreground">Select a voice to enable preview.</p>
            )}
            {previewError && (
              <p className="mt-1 text-xs text-destructive">{previewError}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between border-t pt-6">
        <div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saved && (
            <p className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Saved
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/characters`)}
          >
            Back
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Character
          </Button>
        </div>
      </div>
    </div>
  );
}
