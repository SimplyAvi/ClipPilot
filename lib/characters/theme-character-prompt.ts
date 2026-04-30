import type { Theme } from "@prisma/client";
import { CHARACTER_FROM_THEME_PROMPT } from "@/lib/prompts/character-from-theme";

function value(text: string | null | undefined, fallback = "Not specified"): string {
  return text?.trim() || fallback;
}

export function buildCharacterFromThemePrompt(theme: Theme, gender: "man" | "woman") {
  const replacements: Record<string, string> = {
    genre: value(theme.genre, "short-form cinematic drama"),
    tone: value(theme.tone, "emotionally grounded"),
    visualStyle: value(theme.visualStyle, "cinematic social video"),
    cinematographyNotes: value(theme.cinematographyNotes),
    environmentDescription: value(theme.environmentDescription ?? theme.primaryEnvironment),
    characterAppearance: value(theme.characterAppearance),
    characterMood: value(theme.characterMood),
    colorMood: value(theme.colorMood),
    gender,
  };

  return CHARACTER_FROM_THEME_PROMPT.replace(/\{(\w+)\}/g, (_, key: string) => replacements[key] ?? "");
}

export function summarizeTheme(theme: Theme): string {
  return [
    `Name: ${theme.name}`,
    `Genre: ${value(theme.genre)}`,
    `Tone: ${value(theme.tone)}`,
    `Visual style: ${value(theme.visualStyle)}`,
    `Environment: ${value(theme.environmentDescription ?? theme.primaryEnvironment)}`,
    `Character aesthetic: ${value(theme.characterAppearance)}`,
    `Character mood: ${value(theme.characterMood)}`,
    `Color mood: ${value(theme.colorMood)}`,
    `Prompt modifier: ${value(theme.visualPromptModifier)}`,
  ].join("\n");
}
