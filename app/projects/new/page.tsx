"use client";

import type React from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, ClipboardList, FileText, FileUp, ImageIcon, Layers, Loader2, Mountain, Palette, Sparkles, Upload, UserRound, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const GENRES = [
  { value: "thriller", label: "Thriller" },
  { value: "drama", label: "Drama" },
  { value: "romance", label: "Romance" },
  { value: "horror", label: "Horror" },
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "fantasy", label: "Fantasy" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "mystery", label: "Mystery" },
  { value: "documentary", label: "Documentary" },
  { value: "other", label: "Other" },
];

const TONES = [
  { value: "dark", label: "Dark" },
  { value: "hopeful", label: "Hopeful" },
  { value: "tragic", label: "Tragic" },
  { value: "intimate", label: "Intimate" },
  { value: "epic", label: "Epic" },
  { value: "suspenseful", label: "Suspenseful" },
  { value: "restrained", label: "Restrained" },
  { value: "playful", label: "Playful" },
  { value: "tense", label: "Tense" },
];

const PLATFORMS = [
  { value: "youtube-shorts", label: "YouTube Shorts (max 60s)" },
  { value: "instagram-reels", label: "Instagram Reels (max 90s)" },
  { value: "tiktok", label: "TikTok (max 60s)" },
  { value: "youtube-standard", label: "YouTube Standard (no limit)" },
];

const TARGET_LENGTHS = [
  { value: "ai-recommend", label: "Let AI Recommend", sub: "Claude picks the best fit" },
  { value: "short", label: "Short", sub: "~30 seconds" },
  { value: "medium", label: "Medium", sub: "~60 seconds" },
  { value: "long", label: "Long", sub: "~90 seconds" },
];

const LOADING_MESSAGES = [
  "Reading your script...",
  "Applying the selected theme...",
  "Planning character and visual scenes...",
  "Estimating shot variants...",
  "Finalising your production brief...",
];

type Theme = {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  tone: string | null;
  visualStyle: string | null;
  audioStyle: string | null;
  pacing: string | null;
  primaryEnvironment: string | null;
  lightingStyle: string | null;
  cameraMovement: string | null;
  musicMood: string | null;
  musicTempo: string | null;
  colorPalette: string | null;
  visualPromptModifier: string | null;
  referenceFramePaths: string | null;
  coverFrameIndex: number;
};

type ProductionMode = "character_driven" | "visual_only" | "mixed";
type ThemeChoice = "theme" | "manual";

type TemplateMeta = { id: string; name: string };

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [themeQuery, setThemeQuery] = useState("");
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("manual");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [themeOverrideMode, setThemeOverrideMode] = useState<"fill_empty" | "replace_all">("fill_empty");
  const [themeMode, setThemeMode] = useState<"single" | "per_scene">("single");
  const [productionMode, setProductionMode] = useState<ProductionMode>("character_driven");
  const [variantCount, setVariantCount] = useState(2);

  const [activeTemplate, setActiveTemplate] = useState<TemplateMeta | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [inputTab, setInputTab] = useState<"paste" | "upload">("paste");
  const [projectName, setProjectName] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [targetLength, setTargetLength] = useState("ai-recommend");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedThemeId) ?? null,
    [selectedThemeId, themes]
  );

  const filteredThemes = useMemo(() => {
    const q = themeQuery.trim().toLowerCase();
    if (!q) return themes;
    return themes.filter((theme) => [theme.name, theme.genre, theme.tone, theme.description].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [themeQuery, themes]);

  useEffect(() => {
    fetch("/api/themes", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const loaded = json.data ?? [];
        setThemes(loaded);
        const queryThemeId = searchParams.get("themeId");
        const initial = queryThemeId && loaded.some((theme: Theme) => theme.id === queryThemeId) ? queryThemeId : loaded[0]?.id;
        if (initial) {
          setThemeChoice("theme");
          setSelectedThemeId(initial);
        }
      })
      .catch(() => setThemes([]))
      .finally(() => setLoadingThemes(false));
  }, [searchParams]);

  useEffect(() => {
    const templateId = searchParams.get("templateId");
    if (!templateId) return;
    setLoadingTemplate(true);
    fetch(`/api/templates/${templateId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) return;
        const t = json.data;
        setActiveTemplate({ id: t.id, name: t.name });
        if (t.genre) setGenre(t.genre);
        if (t.tone) setTone(t.tone);
        if (t.targetPlatform) setPlatform(t.targetPlatform);
        if (t.targetLength) setTargetLength(t.targetLength);
      })
      .catch(() => undefined)
      .finally(() => setLoadingTemplate(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTheme || themeOverrideMode !== "replace_all") return;
    applyThemeToSettings(selectedTheme, true);
  }, [selectedTheme, themeOverrideMode]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 3000);
    return () => clearInterval(interval);
  }, [loading]);

  function applyThemeToSettings(theme: Theme, replaceAll = false) {
    if ((replaceAll || !genre) && theme.genre) setGenre(normalizeOption(theme.genre, GENRES) ?? genre);
    if ((replaceAll || !tone) && theme.tone) setTone(normalizeOption(theme.tone, TONES) ?? tone);
    if ((replaceAll || targetLength === "ai-recommend") && theme.pacing) {
      setTargetLength(theme.pacing === "Fast" ? "short" : theme.pacing === "Slow" ? "long" : "medium");
    }
  }

  function goNextFromTheme() {
    if (selectedTheme && themeChoice === "theme") applyThemeToSettings(selectedTheme, themeOverrideMode === "replace_all");
    setStep(2);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      setError("Only .txt and .pdf files are supported. Please upload one of those.");
      return;
    }
    setFileName(file.name);
    setError(null);
    if (ext === "txt") {
      setScriptText(await file.text());
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/scripts/extract-text", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setScriptText(json.data.text);
      setInputTab("paste");
    } catch {
      setError("Could not read this PDF. Try copying and pasting the text directly instead.");
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectName.trim()) { setError("Project name is required."); setStep(3); return; }
    if (!scriptText.trim() || scriptText.trim().length < 50) { setError("Script must be at least 50 characters. Please add more content."); setStep(3); return; }
    if (!genre) { setError("Please select a genre."); setStep(3); return; }
    if (!tone) { setError("Please select a tone."); setStep(3); return; }
    if (!platform) { setError("Please select a target platform."); setStep(3); return; }

    setLoading(true);
    setLoadingMsgIdx(0);
    try {
      const res = await fetch("/api/scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          scriptText,
          genre,
          tone,
          platform,
          targetLength,
          themeId: themeChoice === "theme" ? selectedThemeId : undefined,
          themeMode,
          themeOverrideMode,
          productionMode,
          variantCount,
        }),
      });
      const json = await res.json();
      if (res.status === 503) { setError("Anthropic API key not configured. Go to Settings -> AI Providers to add your key."); setStep(3); return; }
      if (res.status === 429) { setError("Too many requests - please wait a moment and try again."); setStep(3); return; }
      if (!res.ok || json.error) { setError(json.error ?? "Analysis failed. Please try again."); setStep(3); return; }
      router.push(`/projects/${json.data.projectId}/analysis`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 py-32 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
          <Loader2 className="absolute h-10 w-10 animate-spin text-primary" style={{ animationDuration: "0.75s" }} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">{LOADING_MESSAGES[loadingMsgIdx]}</p>
          <p className="text-sm text-muted-foreground">This can take 10-30 seconds for longer scripts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
          <p className="mt-1 text-muted-foreground">Create a production brief shaped by themes, characters, and shot variants.</p>
        </div>
        <StepDots step={step} />
      </div>

      {loadingTemplate && <InfoBanner icon={<Loader2 className="h-4 w-4 animate-spin" />} text="Loading template settings..." />}
      {activeTemplate && !loadingTemplate && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700">
          <Sparkles className="h-4 w-4" /> Using template: <span className="font-semibold">{activeTemplate.name}</span>
          <button onClick={() => setActiveTemplate(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {step === 1 && (
          <section className="space-y-6">
            <StepHeading title="Start with a Style" subtitle="Choose a theme to define how your video will look and feel, or skip and configure manually." />
            <div className="grid gap-4 lg:grid-cols-2">
              <ChoiceCard selected={themeChoice === "theme"} disabled={!themes.length} onClick={() => themes.length && setThemeChoice("theme")} icon={<Palette className="h-5 w-5" />} title="Use a Theme" subtitle={themes.length ? "Recommended - apply a saved cinematic style." : "No themes yet. Create themes from videos you love."}>
                <div className="mt-4 flex gap-2">
                  {themes.slice(0, 3).map((theme) => <ThemeSwatch key={theme.id} theme={theme} />)}
                </div>
              </ChoiceCard>
              <ChoiceCard selected={themeChoice === "manual"} onClick={() => { setThemeChoice("manual"); setSelectedThemeId(null); }} icon={<Wand2 className="h-5 w-5" />} title="Configure Manually" subtitle="Set genre, tone, and production style yourself." />
            </div>

            {themeChoice === "theme" && themes.length > 0 && (
              <div className="space-y-4 rounded-lg border p-4">
                <Input value={themeQuery} onChange={(e) => setThemeQuery(e.target.value)} placeholder="Search themes..." />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredThemes.map((theme) => (
                    <button key={theme.id} type="button" onClick={() => setSelectedThemeId(theme.id)} className={`relative rounded-lg border p-4 text-left transition hover:border-primary/70 ${selectedThemeId === theme.id ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}>
                      {selectedThemeId === theme.id && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                      <ThemePreview theme={theme} />
                    </button>
                  ))}
                </div>
                {selectedTheme && (
                  <div className="grid gap-3 rounded-lg bg-muted/50 p-4 lg:grid-cols-[1fr_320px]">
                    <div>
                      <p className="font-semibold">{selectedTheme.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedTheme.description ?? "Theme selected for this project."}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <label className="flex gap-2"><input type="radio" checked={themeOverrideMode === "fill_empty"} onChange={() => setThemeOverrideMode("fill_empty")} />Fill my empty settings</label>
                      <label className="flex gap-2"><input type="radio" checked={themeOverrideMode === "replace_all"} onChange={() => setThemeOverrideMode("replace_all")} />Apply theme to everything</label>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setThemeChoice("manual"); setSelectedThemeId(null); setStep(2); }}>Skip - No Theme</Button><Button type="button" onClick={goNextFromTheme}>Next: Production Mode</Button></div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <StepHeading title="What kind of video is this?" subtitle="This decides whether ClipPilot builds a character pipeline or a visual-only pipeline." />
            <div className="grid gap-4 lg:grid-cols-3">
              <ProductionCard value="character_driven" selected={productionMode === "character_driven"} onSelect={setProductionMode} icon={<UserRound className="h-6 w-6" />} title="Character-Driven" copy="People are on screen. Generate portraits, voices, dialogue, lip sync, and character-consistent visuals." examples="Short film, drama, monologue, thriller" />
              <ProductionCard value="visual_only" selected={productionMode === "visual_only"} onSelect={setProductionMode} icon={<Mountain className="h-6 w-6" />} title="Visual Only" copy="No on-screen characters. Focus on environments, objects, atmospheres, narration, and visual storytelling." examples="Product showcase, travel, atmosphere, documentary" />
              <ProductionCard value="mixed" selected={productionMode === "mixed"} onSelect={setProductionMode} icon={<Layers className="h-6 w-6" />} title="Mixed" copy="Some scenes have characters and some are visual-only. Decide per scene after analysis." examples="Story scenes plus transition/environment scenes" />
            </div>
            <div className="flex justify-between"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button type="button" onClick={() => setStep(3)}>Next: Your Story</Button></div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <StepHeading title="Your Story" subtitle="Paste or upload the script. The selected theme and production mode will guide the analysis." />
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <Field label="Project Name"><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. The Last Conversation" required /></Field>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Script</CardTitle><CardDescription>Paste your script text or upload a file.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-1 rounded-lg bg-muted p-1">
                      <button type="button" onClick={() => setInputTab("paste")} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${inputTab === "paste" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><ClipboardList className="h-3.5 w-3.5" />Paste Text</button>
                      <button type="button" onClick={() => setInputTab("upload")} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${inputTab === "upload" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><FileUp className="h-3.5 w-3.5" />Upload File</button>
                    </div>
                    {inputTab === "paste" ? <Textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} className="min-h-64 font-mono text-xs leading-relaxed" placeholder={"INT. COFFEE SHOP - DAY\n\nMAYA sits across from JASON..."} /> : <UploadBox fileName={fileName} scriptLength={scriptText.length} inputRef={fileInputRef} onChange={handleFileChange} />}
                    <p className="text-right text-xs text-muted-foreground">{scriptText.length.toLocaleString()} / 20,000 characters</p>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Genre"><Select value={genre} onValueChange={setGenre}><SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger><SelectContent>{GENRES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Tone"><Select value={tone} onValueChange={setTone}><SelectTrigger><SelectValue placeholder="Select tone" /></SelectTrigger><SelectContent>{TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></Field>
                </div>
                <Field label="Target Platform"><Select value={platform} onValueChange={setPlatform}><SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Target Length"><div className="grid gap-2 sm:grid-cols-2">{TARGET_LENGTHS.map((opt) => <button key={opt.value} type="button" onClick={() => setTargetLength(opt.value)} className={`rounded-lg border-2 px-3 py-2.5 text-left ${targetLength === opt.value ? "border-primary bg-primary/5" : "border-border"}`}><span className="block text-sm font-medium">{opt.label}</span><span className="text-xs text-muted-foreground">{opt.sub}</span></button>)}</div></Field>
              </div>
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex justify-between"><Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button><Button type="button" onClick={() => setStep(4)}>Next: Project Brief</Button></div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6">
            <StepHeading title="Project Brief" subtitle="Review the production plan before ClipPilot analyzes and saves the project." />
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <SummarySection title="Project Identity"><SummaryGrid rows={[["Project", projectName || "Untitled"], ["Platform", labelFor(platform, PLATFORMS) || "Not selected"], ["Length", labelFor(targetLength, TARGET_LENGTHS) || targetLength], ["Production", productionModeLabel(productionMode)]]} /></SummarySection>
                <SummarySection title="Theme Applied">
                  {selectedTheme && themeChoice === "theme" ? <div className="space-y-3"><ThemePreview theme={selectedTheme} /><p className="text-sm text-muted-foreground">This theme&apos;s visual modifier will be applied to generated shot prompts.</p><pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{selectedTheme.visualPromptModifier || "No visual prompt modifier saved for this theme."}</pre><div className="flex gap-2 text-sm"><label><input type="radio" checked={themeMode === "single"} onChange={() => setThemeMode("single")} /> Single theme throughout</label><label><input type="radio" checked={themeMode === "per_scene"} onChange={() => setThemeMode("per_scene")} /> Different theme per scene</label></div></div> : <p className="text-sm text-muted-foreground">No theme selected. Generation will use your manual settings.</p>}
                </SummarySection>
                {productionMode !== "visual_only" && <SummarySection title="Characters"><p className="text-sm text-muted-foreground">Characters can be generated from the selected theme or picked from the global library after the script analysis is saved.</p><div className="mt-3 flex gap-2"><Button type="button" variant="outline" disabled={!selectedTheme}>Generate Character from Theme</Button><Button type="button" variant="outline">Pick from Character Library</Button></div></SummarySection>}
              </div>
              <div className="space-y-4">
                <SummarySection title="Generation Settings"><SummaryGrid rows={[["Genre", labelFor(genre, GENRES) || "Not selected"], ["Tone", labelFor(tone, TONES) || "Not selected"], ["Theme mode", themeMode === "single" ? "Single" : "Per scene"], ["Override mode", themeOverrideMode === "fill_empty" ? "Fill empty" : "Apply to everything"]]} /></SummarySection>
                <SummarySection title="Variant Options"><div className="grid gap-2">{[1, 2, 3].map((count) => <button key={count} type="button" onClick={() => setVariantCount(count)} className={`rounded-lg border p-3 text-left ${variantCount === count ? "border-primary bg-primary/5" : ""}`}><span className="font-medium">{count} {count === 1 ? "variant" : "variants"} per shot</span><span className="block text-xs text-muted-foreground">{count === 1 ? "Fastest" : count === 2 ? "Recommended balance" : "Most choice, highest cost"}</span></button>)}</div><p className="mt-3 text-xs text-muted-foreground">More variants cost more but let you compare and pick the best result for each shot.</p></SummarySection>
              </div>
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex justify-between"><Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button><Button type="submit" size="lg">Save Project Brief & Continue to Generation</Button></div>
          </section>
        )}
      </form>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return <div className="flex gap-2">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-2.5 w-10 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />)}</div>;
}
function StepHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-muted-foreground">{subtitle}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function ErrorBanner({ message }: { message: string }) { return <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>; }
function InfoBanner({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-muted-foreground">{icon}{text}</div>; }
function ChoiceCard({ selected, disabled, onClick, icon, title, subtitle, children }: { selected: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; children?: React.ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg border-2 p-6 text-left transition disabled:opacity-50 ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}><div className="flex items-start gap-4"><div className="rounded-lg bg-muted p-3 text-primary">{icon}</div><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div></div>{children}</button>; }
function ProductionCard({ value, selected, onSelect, icon, title, copy, examples }: { value: ProductionMode; selected: boolean; onSelect: (value: ProductionMode) => void; icon: React.ReactNode; title: string; copy: string; examples: string }) { return <button type="button" onClick={() => onSelect(value)} className={`rounded-lg border-2 p-5 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}><div className="mb-4 flex items-center gap-3"><div className="rounded-lg bg-muted p-3 text-primary">{icon}</div><p className="font-semibold uppercase tracking-wide">{title}</p></div><p className="text-sm text-muted-foreground">{copy}</p><p className="mt-4 text-xs text-muted-foreground">Examples: {examples}</p></button>; }
function UploadBox({ fileName, scriptLength, inputRef, onChange }: { fileName: string | null; scriptLength: number; inputRef: React.RefObject<HTMLInputElement>; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) { return <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center"><input ref={inputRef} type="file" accept=".txt,.pdf" className="hidden" onChange={onChange} />{fileName ? <><FileText className="h-10 w-10 text-primary" /><div><p className="text-sm font-medium">{fileName}</p><p className="mt-0.5 text-xs text-muted-foreground">{scriptLength.toLocaleString()} characters extracted</p></div><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Replace file</Button></> : <><Upload className="h-10 w-10 text-muted-foreground" /><div><p className="text-sm font-medium">Drop a file here or click to browse</p><p className="mt-0.5 text-xs text-muted-foreground">Accepts .txt and .pdf</p></div><Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>Choose file</Button></>}</div>; }
function ThemePreview({ theme }: { theme: Theme }) { return <div><div className="mb-3 flex h-24 items-center justify-center rounded-lg border bg-muted"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div><p className="font-medium">{theme.name}</p><div className="mt-2 flex flex-wrap gap-1">{[theme.genre, theme.tone, theme.visualStyle].filter(Boolean).slice(0, 3).map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div><div className="mt-3 flex gap-1">{parsePalette(theme.colorPalette).slice(0, 5).map((color) => <span key={color} className="h-4 w-8 rounded-sm border" style={{ backgroundColor: color }} />)}</div></div>; }
function ThemeSwatch({ theme }: { theme: Theme }) { const palette = parsePalette(theme.colorPalette); return <span title={theme.name} className="flex h-9 w-14 overflow-hidden rounded-md border">{palette.length ? palette.slice(0, 3).map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />) : <span className="flex flex-1 items-center justify-center bg-muted"><Palette className="h-3 w-3" /></span>}</span>; }
function SummarySection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border p-4"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>; }
function SummaryGrid({ rows }: { rows: Array<[string, string]> }) { return <div className="grid gap-3 text-sm">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>)}</div>; }
function labelFor(value: string, options: Array<{ value: string; label: string }>) { return options.find((option) => option.value === value)?.label; }
function normalizeOption(value: string, options: Array<{ value: string; label: string }>) { const lower = value.toLowerCase(); return options.find((option) => option.value === lower || option.label.toLowerCase() === lower)?.value; }
function productionModeLabel(value: ProductionMode) { return value === "character_driven" ? "Character-Driven" : value === "visual_only" ? "Visual Only" : "Mixed"; }
function parsePalette(raw: string | null): string[] { if (!raw) return []; try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : []; } catch { return []; } }

export default function NewProjectPage() {
  return <Suspense fallback={<div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">Loading...</div>}><NewProjectForm /></Suspense>;
}
