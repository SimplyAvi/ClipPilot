import type { Theme } from "@prisma/client";
import { db } from "@/lib/db";

export interface ProjectConfig {
  genre?: string | null;
  tone?: string | null;
  visualStyle?: string | null;
  audioStyle?: string | null;
  suggestedPacing?: string | null;
  suggestedLength?: "short" | "medium" | "long";
  musicMood?: string | null;
  musicTempo?: string | null;
  environment?: string | null;
  lightingStyle?: string | null;
  cameraMovement?: string | null;
}

export async function getThemeForScene(sceneId: string): Promise<Theme | null> {
  const scene = await db.scene.findUnique({
    where: { id: sceneId },
    include: {
      theme: true,
      project: { include: { theme: true } },
    },
  });

  if (!scene) return null;
  if (scene.useProjectTheme === false && scene.themeId) return scene.theme;
  return scene.project.theme;
}

export async function getThemeForProject(projectId: string): Promise<Theme | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { theme: true },
  });
  return project?.theme ?? null;
}

export function buildVisualPromptWithTheme(basePrompt: string, theme: Theme | null): string {
  if (!theme?.visualPromptModifier) return basePrompt;
  return [basePrompt, theme.visualPromptModifier].filter(Boolean).join(". ");
}

export function buildAudioPromptWithTheme(basePrompt: string, theme: Theme | null): string {
  if (!theme?.audioPromptModifier) return basePrompt;
  return [basePrompt, theme.audioPromptModifier].filter(Boolean).join(". ");
}

export function getThemeProjectConfig(theme: Theme): Partial<ProjectConfig> {
  return {
    genre: theme.genre,
    tone: theme.tone,
    visualStyle: theme.visualStyle,
    audioStyle: theme.audioStyle,
    suggestedPacing: theme.pacing,
    suggestedLength:
      theme.pacing === "Fast" ? "short" : theme.pacing === "Slow" ? "long" : "medium",
    musicMood: theme.musicMood,
    musicTempo: theme.musicTempo,
    environment: theme.primaryEnvironment,
    lightingStyle: theme.lightingStyle,
    cameraMovement: theme.cameraMovement,
  };
}
