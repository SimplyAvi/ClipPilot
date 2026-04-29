"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

// ─── Option lists (mirrors /projects/new) ─────────────────────────────────────

const GENRES = [
  "thriller", "drama", "romance", "horror", "action",
  "comedy", "fantasy", "sci-fi", "mystery", "documentary", "other",
];
const TONES = [
  "dark", "hopeful", "tragic", "intimate", "epic",
  "suspenseful", "restrained", "playful", "tense",
];
const PLATFORMS = [
  { value: "youtube-shorts", label: "YouTube Shorts" },
  { value: "instagram-reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube-standard", label: "YouTube Standard" },
];
const LENGTHS = [
  { value: "short", label: "Short (~30s)" },
  { value: "medium", label: "Medium (~60s)" },
  { value: "long", label: "Long (~90s)" },
  { value: "ai-recommend", label: "Let AI Recommend" },
];
const VISUAL_STYLES = [
  "noir-cinematic", "stylized-realism", "live-action-cinematic",
  "documentary-real", "high-contrast-noir", "futuristic-cinematic", "other",
];
const AUDIO_STYLES = [
  "minimal-suspense", "sparse-piano", "orchestral-swell",
  "documentary-natural", "silence-heavy-dramatic", "electronic-ambient", "other",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateData {
  id: string;
  name: string;
  description: string;
  genre: string;
  tone: string;
  visualStyle: string;
  audioStyle: string;
  targetPlatform: string;
  targetLength: string;
  isBuiltIn: boolean;
  usageCount: number;
  characterConfig: string | null;
  musicConfig: string | null;
  generationConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            Delete this template? This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TemplateEditor({ template }: { template: TemplateData }) {
  const router = useRouter();

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [genre, setGenre] = useState(template.genre);
  const [tone, setTone] = useState(template.tone);
  const [visualStyle, setVisualStyle] = useState(template.visualStyle);
  const [audioStyle, setAudioStyle] = useState(template.audioStyle);
  const [targetPlatform, setTargetPlatform] = useState(template.targetPlatform);
  const [targetLength, setTargetLength] = useState(template.targetLength);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          genre,
          tone,
          visualStyle,
          audioStyle,
          targetPlatform,
          targetLength,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/templates");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Basic info ── */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Template Details</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tmpl-name">Name</Label>
          <Input
            id="tmpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tmpl-desc">Description</Label>
          <Textarea
            id="tmpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this template best for?"
            rows={3}
          />
        </div>
      </div>

      {/* ── Style settings ── */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Style Settings</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{capitalize(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Visual Style</Label>
            <Select value={visualStyle} onValueChange={setVisualStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISUAL_STYLES.map((vs) => (
                  <SelectItem key={vs} value={vs}>{capitalize(vs)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Audio Style</Label>
            <Select value={audioStyle} onValueChange={setAudioStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIO_STYLES.map((as) => (
                  <SelectItem key={as} value={as}>{capitalize(as)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Target Platform</Label>
            <Select value={targetPlatform} onValueChange={setTargetPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Target Length</Label>
            <Select value={targetLength} onValueChange={setTargetLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTHS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Preview chips ── */}
      <div className="rounded-xl border bg-muted/40 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Preview Settings
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Genre", value: genre },
            { label: "Tone", value: tone },
            { label: "Visual", value: visualStyle },
            { label: "Audio", value: audioStyle },
            { label: "Platform", value: targetPlatform },
            { label: "Length", value: targetLength },
          ].map(({ label, value }) => (
            <span
              key={label}
              className="rounded-full border bg-background px-3 py-1 text-xs"
            >
              <span className="text-muted-foreground">{label}: </span>
              <span className="font-medium capitalize">{capitalize(value)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-4 w-4" /> Delete template
        </Button>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="h-4 w-4 text-green-500" /> Saved!</>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
