"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Sparkles, UserRound, X } from "lucide-react";

export type CharacterThemeOption = {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  tone: string | null;
  colorPalette: string | null;
  colorMood: string | null;
  coverFrameIndex: number;
};

type Props = {
  themes: CharacterThemeOption[];
  initialThemeId?: string | null;
  triggerClassName?: string;
};

const messages = [
  "Reading the theme's world...",
  "Designing a character who fits this story...",
  "Writing their biography...",
  "Finding their voice...",
  "Building their portrait prompt...",
  "Almost there...",
];

export function GenerateFromThemeModal({ themes, initialThemeId = null, triggerClassName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(initialThemeId ? 2 : 1);
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState<string | null>(initialThemeId);
  const [gender, setGender] = useState<"man" | "woman" | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? null;
  const filteredThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return themes;
    return themes.filter((theme) =>
      [theme.name, theme.genre, theme.tone, theme.description].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [query, themes]);

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => setMessageIndex((current) => (current + 1) % messages.length), 3000);
    return () => window.clearInterval(id);
  }, [loading]);

  function begin() {
    setOpen(true);
    setStep(initialThemeId ? 2 : 1);
    setThemeId(initialThemeId);
    setGender(null);
    setError(null);
  }

  async function generate() {
    if (!themeId || !gender) return;
    setStep(3);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/characters/generate-from-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId, gender }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 206) throw new Error(json.error ?? "Character generation failed");
      const tempId = json.data.tempId;
      window.localStorage.setItem(`generated-character:${tempId}`, JSON.stringify(json.data));
      window.localStorage.setItem("generated-character:last-draft", tempId);
      setOpen(false);
      router.push(`/characters/review/${tempId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character generation failed");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={begin} className={triggerClassName}>
        <Sparkles className="mr-2 h-4 w-4" />Generate from Theme
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background">
          {step !== 3 && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-lg border bg-card"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {step === 1 && (
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-bold">Which theme should shape this character?</h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  The theme&apos;s genre, tone, environment, and visual style will be used to generate a character that fits naturally in that world.
                </p>
              </div>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search themes..." className="mb-6 max-w-xl" />
              {themes.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                  <p className="text-lg font-semibold">You haven&apos;t created any themes yet.</p>
                  <Button asChild className="mt-4"><Link href="/themes/new">Create a theme first</Link></Button>
                </div>
              ) : (
                <div className="grid flex-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredThemes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      className={`group overflow-hidden rounded-lg border bg-card text-left transition ${themeId === theme.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                    >
                      <div className="relative aspect-video bg-muted">
                        <img src={`/api/themes/${theme.id}/frame/${theme.coverFrameIndex}`} alt={theme.name} className="h-full w-full object-cover" />
                        {themeId === theme.id && <span className="absolute right-3 top-3 rounded-full bg-primary p-1 text-primary-foreground"><Check className="h-4 w-4" /></span>}
                      </div>
                      <div className="space-y-2 p-4">
                        <h3 className="font-semibold">{theme.name}</h3>
                        <p className="text-sm text-muted-foreground">{[theme.genre, theme.tone].filter(Boolean).join(" - ") || "Theme profile"}</p>
                        {theme.description && <p className="line-clamp-2 text-xs text-muted-foreground">{theme.description}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-8 flex justify-end gap-3 border-t pt-5">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!themeId || themes.length === 0}>Next: Choose Gender</Button>
              </div>
            </div>
          )}

          {step === 2 && selectedTheme && (
            <div className="relative min-h-screen overflow-hidden">
              <img src={`/api/themes/${selectedTheme.id}/frame/${selectedTheme.coverFrameIndex}`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
              <div className="absolute inset-0 bg-background/85" />
              <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
                <h2 className="text-3xl font-bold">Who is this character?</h2>
                <p className="mt-2 text-muted-foreground">{selectedTheme.name} - {[selectedTheme.genre, selectedTheme.tone].filter(Boolean).join(" - ")}</p>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {(["man", "woman"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGender(option)}
                      className={`min-h-60 rounded-lg border bg-card p-8 text-center transition ${gender === option ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                    >
                      <UserRound className="mx-auto mb-5 h-14 w-14 text-muted-foreground" />
                      <h3 className="text-2xl font-semibold capitalize">{option}</h3>
                      <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
                        AI will generate a {option === "man" ? "male" : "female"} character with voice to match.
                      </p>
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-sm text-muted-foreground">
                  Ethnicity defaults to ethnically ambiguous for broader representation. You can edit it after the character is generated.
                </p>
                {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                <div className="mt-8 flex justify-between border-t pt-5">
                  <Button variant="outline" onClick={() => setStep(initialThemeId ? 2 : 1)} disabled={initialThemeId !== null}>Back</Button>
                  <Button onClick={generate} disabled={!gender}>
                    Generate {gender ? gender[0].toUpperCase() + gender.slice(1) : "Character"} from {selectedTheme.name}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && selectedTheme && (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden text-center">
              <img src={`/api/themes/${selectedTheme.id}/frame/${selectedTheme.coverFrameIndex}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/75" />
              <div className="relative max-w-md px-6 text-white">
                <div className="mx-auto mb-8 flex h-28 w-28 animate-pulse items-center justify-center rounded-full border border-white/30 bg-white/10">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <div className="mx-auto mb-6 h-40 w-28 overflow-hidden rounded-full border border-white/40 bg-white/10">
                  <div className="h-full w-full animate-[characterFill_5s_ease-in-out_infinite] bg-white/45" />
                </div>
                <h2 className="text-2xl font-bold">{messages[messageIndex]}</h2>
                <p className="mt-3 text-sm text-white/70">This takes about 15-30 seconds</p>
              </div>
              <style jsx>{`
                @keyframes characterFill {
                  0% { transform: translateY(100%); opacity: 0.2; }
                  50% { transform: translateY(15%); opacity: 0.8; }
                  100% { transform: translateY(0); opacity: 0.5; }
                }
              `}</style>
            </div>
          )}
        </div>
      )}
    </>
  );
}
