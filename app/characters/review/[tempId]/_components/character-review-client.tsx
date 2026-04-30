"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { Loader2, Play, RotateCcw, Save, Sparkles } from "lucide-react";

type GeneratedCharacter = {
  nameOptions: Array<{ name: string; meaningOrOrigin: string }>;
  suggestedEthnicity: string;
  heritage: string;
  age: number;
  physicalDescription: string;
  distinctiveFeature: string;
  defaultWardrobe: string;
  biography: string;
  personality: string;
  motivations: string;
  fears: string;
  quirks: string;
  emotionalRange: "low" | "medium" | "high";
  gestureTendencies: string;
  forbiddenChanges: string;
  voiceProfile: {
    toneDescription: string;
    pitch: string;
    pace: string;
    accent: string;
    accentStrength: string;
    emotionalDelivery: string;
    speechPatterns: string;
    elevenLabsSearchTerms: string;
    voiceReferenceNote: string;
  };
  portraitPrompt: string;
  role: "protagonist" | "supporting" | "antagonist" | "narrator";
  suggestedTags: string[];
  castingNote: string;
};

type Draft = {
  tempId: string;
  themeId: string;
  themeName: string;
  gender: "man" | "woman";
  character: GeneratedCharacter;
};

type PortraitVariant = { path: string | null; url: string | null; flagged: boolean; message: string | null };
type VoiceMatch = { voice_id: string; name: string; preview_url: string | null; labels: Record<string, string>; score: number };

const ethnicityOptions = [
  "Ethnically Ambiguous (Recommended)",
  "Multiracial / Mixed Heritage",
  "Middle Eastern / North African",
  "South Asian",
  "East Asian",
  "Southeast Asian",
  "Black / African Heritage",
  "Latin / Hispanic Heritage",
  "Eastern European",
  "Western European",
  "Indigenous / First Nations",
  "Pacific Islander",
];

export function CharacterReviewClient({ tempId }: { tempId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [customName, setCustomName] = useState("");
  const [portraits, setPortraits] = useState<PortraitVariant[]>([]);
  const [selectedPortrait, setSelectedPortrait] = useState("");
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [portraitMessage, setPortraitMessage] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceMatch[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(`generated-character:${tempId}`);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Draft;
    setDraft(parsed);
    setSelectedName(parsed.character.nameOptions[0]?.name ?? "");
  }, [tempId]);

  useEffect(() => {
    if (!draft) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "You have an unsaved character. Leave without saving?";
    };
    window.addEventListener("beforeunload", handler);
    window.localStorage.setItem(`generated-character:${tempId}`, JSON.stringify(draft));
    window.localStorage.setItem("generated-character:last-draft", tempId);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft, tempId]);

  useEffect(() => {
    if (!draft || portraits.length > 0 || portraitLoading) return;
    generatePortraits();
    matchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const character = draft?.character;
  const chosenName = customName.trim() || selectedName;
  const biographyWords = useMemo(() => character?.biography.trim().split(/\s+/).filter(Boolean).length ?? 0, [character?.biography]);

  function updateCharacter<K extends keyof GeneratedCharacter>(key: K, value: GeneratedCharacter[K]) {
    setDraft((current) => current ? { ...current, character: { ...current.character, [key]: value } } : current);
  }

  function updateVoice<K extends keyof GeneratedCharacter["voiceProfile"]>(key: K, value: GeneratedCharacter["voiceProfile"][K]) {
    setDraft((current) => current ? {
      ...current,
      character: { ...current.character, voiceProfile: { ...current.character.voiceProfile, [key]: value } },
    } : current);
  }

  async function generatePortraits() {
    if (!draft) return;
    setPortraitLoading(true);
    setPortraitMessage(null);
    try {
      const res = await fetch("/api/characters/generate-themed-portraits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempId,
          themeId: draft.themeId,
          characterName: chosenName || draft.character.nameOptions[0]?.name,
          portraitPrompt: [
            draft.character.portraitPrompt,
            "Ultra-detailed cinematic portrait,",
            "fictional character not based on any real person",
          ].join(" "),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Portrait generation failed");
      if (json.data.missingKey) {
        setPortraitMessage(json.data.message);
        return;
      }
      setPortraits(json.data.variants);
      const first = json.data.variants.find((v: PortraitVariant) => v.path);
      if (first?.path) setSelectedPortrait(first.path);
    } catch (err) {
      setPortraitMessage(err instanceof Error ? err.message : "Portrait generation failed");
    } finally {
      setPortraitLoading(false);
    }
  }

  async function matchVoices() {
    if (!draft) return;
    setVoiceLoading(true);
    setVoiceMessage(null);
    try {
      const vp = draft.character.voiceProfile;
      const res = await fetch("/api/characters/match-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elevenLabsSearchTerms: vp.elevenLabsSearchTerms,
          gender: draft.gender,
          pitch: vp.pitch,
          pace: vp.pace,
          accent: vp.accent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Voice matching failed");
      if (json.data.missingKey) {
        setVoiceMessage(json.data.message);
        return;
      }
      setVoices(json.data.voices);
      if (json.data.voices[0]?.voice_id) setSelectedVoice(json.data.voices[0].voice_id);
    } catch (err) {
      setVoiceMessage(err instanceof Error ? err.message : "Voice matching failed");
    } finally {
      setVoiceLoading(false);
    }
  }

  async function regenerateField(field: "biography" | "personality" | "voice") {
    if (!draft) return;
    setRegenerating(field);
    try {
      const res = await fetch("/api/characters/regenerate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, currentCharacterData: draft.character, themeId: draft.themeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Regeneration failed");
      if (field === "biography" && typeof json.data.biography === "string") updateCharacter("biography", json.data.biography);
      if (field === "personality") {
        setDraft((current) => current ? { ...current, character: { ...current.character, ...json.data } } : current);
      }
      if (field === "voice" && json.data.voiceProfile) {
        updateCharacter("voiceProfile", json.data.voiceProfile);
        setVoices([]);
        setSelectedVoice("");
        setTimeout(matchVoices, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(null);
    }
  }

  async function save() {
    if (!draft || !character) return;
    if (!chosenName) {
      setError("Choose or type a name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/characters/save-generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId: draft.themeId,
          gender: draft.gender,
          selectedName: chosenName,
          selectedPortraitPath: selectedPortrait || null,
          selectedVoiceId: selectedVoice || null,
          character,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      window.localStorage.removeItem(`generated-character:${tempId}`);
      window.localStorage.removeItem("generated-character:last-draft");
      router.push(json.data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function playPreview(url: string | null) {
    if (!url) return;
    audioRef.current?.pause();
    audioRef.current = new Audio(url);
    audioRef.current.play();
  }

  if (!draft || !character) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Generated character draft not found</h1>
        <p className="mt-2 text-muted-foreground">The temporary draft may have been cleared from this browser.</p>
        <Button asChild className="mt-6"><Link href="/characters">Back to Characters</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b bg-amber-50 px-6 py-3 text-sm text-amber-900">
        Review your generated character - make any changes, then save to your library.
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Choose a Name</h2>
            {character.nameOptions.map((option) => (
              <button
                key={option.name}
                type="button"
                onClick={() => { setSelectedName(option.name); setCustomName(""); }}
                className={`w-full rounded-lg border p-4 text-left ${selectedName === option.name && !customName ? "ring-2 ring-primary" : "bg-card"}`}
              >
                <div className="font-semibold uppercase">{option.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">{option.meaningOrOrigin}</p>
              </button>
            ))}
            <Field label="Or type your own name">
              <Input value={customName} onChange={(event) => setCustomName(event.target.value)} />
            </Field>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Portrait</h2>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Theme locked</span>
            </div>
            {portraitLoading && (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />)}
              </div>
            )}
            {portraitMessage && <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{portraitMessage}</p>}
            {!portraitLoading && portraits.length === 0 && (
              <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                No portrait is selected yet. You can save this character now and generate a portrait later from the character profile.
              </div>
            )}
            {portraits.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {portraits.map((portrait, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={!portrait.path}
                    onClick={() => portrait.path && setSelectedPortrait(portrait.path)}
                    className={`rounded-lg ${selectedPortrait === portrait.path ? "ring-2 ring-primary" : ""}`}
                  >
                    {portrait.path ? <PortraitFrame src={portrait.path} alt={`Portrait ${index + 1}`} size="sm" /> : <div className="flex aspect-[3/4] items-center justify-center rounded-lg border bg-amber-50 p-2 text-xs text-amber-800">Portrait flagged</div>}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={generatePortraits} className="text-sm font-medium underline underline-offset-4" disabled={portraitLoading}>
              Regenerate all
            </button>
            <p className="text-xs text-muted-foreground">Generated with {draft.themeName}</p>
          </section>
        </aside>

        <main className="space-y-5">
          <Panel title="Identity">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input value={chosenName} onChange={(event) => { setCustomName(event.target.value); setSelectedName(""); }} /></Field>
              <Field label="Age"><Input type="number" value={character.age} onChange={(event) => updateCharacter("age", Number(event.target.value))} /></Field>
              <Field label="Gender"><span className="inline-flex h-10 items-center rounded-md border px-3 capitalize text-muted-foreground">{draft.gender}</span></Field>
              <Field label="Role">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={character.role} onChange={(event) => updateCharacter("role", event.target.value as GeneratedCharacter["role"])}>
                  {["protagonist", "supporting", "antagonist", "narrator"].map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </Field>
              <Field label="Suggested Ethnicity/Heritage">
                <Input list="ethnicity-options" value={character.suggestedEthnicity} onChange={(event) => updateCharacter("suggestedEthnicity", event.target.value)} />
                <datalist id="ethnicity-options">{ethnicityOptions.map((option) => <option key={option} value={option} />)}</datalist>
                <p className="text-xs text-muted-foreground">Defaults to ethnically ambiguous for broader representation</p>
              </Field>
              <Field label="Tags"><Input value={character.suggestedTags.join(", ")} onChange={(event) => updateCharacter("suggestedTags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} /></Field>
            </div>
          </Panel>

          <Panel title="Physical Appearance">
            <Field label="Physical Description"><Textarea rows={5} value={character.physicalDescription} onChange={(event) => updateCharacter("physicalDescription", event.target.value)} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Distinctive Feature"><Input value={character.distinctiveFeature} onChange={(event) => updateCharacter("distinctiveFeature", event.target.value)} /></Field>
              <Field label="Forbidden Changes"><Input value={character.forbiddenChanges} onChange={(event) => updateCharacter("forbiddenChanges", event.target.value)} /></Field>
            </div>
            <Field label="Default Wardrobe"><Textarea rows={3} value={character.defaultWardrobe} onChange={(event) => updateCharacter("defaultWardrobe", event.target.value)} /></Field>
          </Panel>

          <Panel title="Biography" action={<MiniRegen loading={regenerating === "biography"} onClick={() => regenerateField("biography")} />}>
            <Textarea rows={8} value={character.biography} onChange={(event) => updateCharacter("biography", event.target.value)} />
            <p className="text-xs text-muted-foreground">{biographyWords} words</p>
          </Panel>

          <Panel title="Personality" action={<MiniRegen loading={regenerating === "personality"} onClick={() => regenerateField("personality")} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Personality"><Textarea rows={3} value={character.personality} onChange={(event) => updateCharacter("personality", event.target.value)} /></Field>
              <Field label="Motivations"><Textarea rows={3} value={character.motivations} onChange={(event) => updateCharacter("motivations", event.target.value)} /></Field>
              <Field label="Fears"><Textarea rows={3} value={character.fears} onChange={(event) => updateCharacter("fears", event.target.value)} /></Field>
              <Field label="Quirks"><Textarea rows={3} value={character.quirks} onChange={(event) => updateCharacter("quirks", event.target.value)} /></Field>
            </div>
            <Field label="Gesture Tendencies"><Textarea rows={3} value={character.gestureTendencies} onChange={(event) => updateCharacter("gestureTendencies", event.target.value)} /></Field>
          </Panel>

          <Panel title="Voice Profile" action={<MiniRegen loading={regenerating === "voice"} onClick={() => regenerateField("voice")} />}>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium">&ldquo;{character.voiceProfile.voiceReferenceNote}&rdquo;</p>
              <p className="mt-3 text-sm text-muted-foreground">Pitch: {character.voiceProfile.pitch} · Pace: {character.voiceProfile.pace} · Accent: {character.voiceProfile.accent}</p>
              <p className="mt-2 text-sm text-muted-foreground">Delivery: {character.voiceProfile.emotionalDelivery}</p>
              <p className="mt-2 text-sm text-muted-foreground">Speech patterns: {character.voiceProfile.speechPatterns}</p>
            </div>
            <h3 className="text-sm font-semibold">Suggested Voices from ElevenLabs</h3>
            {voiceLoading && <div className="grid gap-2 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div>}
            {voiceMessage && <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{voiceMessage}</p>}
            {voices.length > 0 && (
              <div className="grid gap-2 md:grid-cols-3">
                {voices.map((voice) => (
                  <button key={voice.voice_id} type="button" onClick={() => setSelectedVoice(voice.voice_id)} className={`rounded-lg border p-3 text-left ${selectedVoice === voice.voice_id ? "ring-2 ring-primary" : "bg-card"}`}>
                    <p className="font-medium">{voice.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{Object.values(voice.labels).join(", ")}</p>
                    <span onClick={(event) => { event.stopPropagation(); playPreview(voice.preview_url); }} className="mt-2 inline-flex items-center text-xs font-medium"><Play className="mr-1 h-3 w-3" />Play preview</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tone Description"><Textarea rows={3} value={character.voiceProfile.toneDescription} onChange={(event) => updateVoice("toneDescription", event.target.value)} /></Field>
              <Field label="Speech Patterns"><Textarea rows={3} value={character.voiceProfile.speechPatterns} onChange={(event) => updateVoice("speechPatterns", event.target.value)} /></Field>
              <Field label="Pitch"><Input value={character.voiceProfile.pitch} onChange={(event) => updateVoice("pitch", event.target.value)} /></Field>
              <Field label="Pace"><Input value={character.voiceProfile.pace} onChange={(event) => updateVoice("pace", event.target.value)} /></Field>
              <Field label="Accent"><Input value={character.voiceProfile.accent} onChange={(event) => updateVoice("accent", event.target.value)} /></Field>
              <Field label="Accent Strength"><Input value={character.voiceProfile.accentStrength} onChange={(event) => updateVoice("accentStrength", event.target.value)} /></Field>
            </div>
          </Panel>

          <Panel title="Casting Note">
            <Textarea rows={3} value={character.castingNote} onChange={(event) => updateCharacter("castingNote", event.target.value)} className="border-l-4 border-l-primary" />
          </Panel>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Button variant="outline" onClick={() => {
            if (window.confirm("This will discard the current character. Are you sure?")) router.push("/characters");
          }}>
            <RotateCcw className="mr-2 h-4 w-4" />Regenerate Completely
          </Button>
          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save to Library
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2"><Label>{label}</Label>{children}</label>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniRegen({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 w-8 items-center justify-center rounded-md border" title="Regenerate">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
    </button>
  );
}
