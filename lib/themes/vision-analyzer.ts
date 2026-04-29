/**
 * lib/themes/vision-analyzer.ts
 *
 * Sends extracted video frames to Claude with vision to analyze
 * the visual style, cinematography, and production aesthetics.
 * Returns a structured ThemeAnalysisResult.
 */

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/app-settings";
import {
  THEME_ANALYSIS_SYSTEM_PROMPT,
  buildThemeAnalysisPrompt,
  type ThemeAnalysisResponse,
} from "@/lib/prompts/theme-analysis";
import type { ColorPaletteResult } from "./color-extractor";

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function analyzeFramesWithClaude(
  framePaths: string[],
  colorData: ColorPaletteResult
): Promise<ThemeAnalysisResponse> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. Go to Settings → AI Providers."
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // Select up to 8 evenly spaced frames for vision analysis
  const maxFrames = 8;
  const selected = selectFrames(framePaths, maxFrames);

  // Build image blocks from frames
  const imageBlocks: Anthropic.ImageBlockParam[] = selected.map((framePath) => {
    const data = fs.readFileSync(framePath);
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: data.toString("base64"),
      },
    };
  });

  const userPrompt = buildThemeAnalysisPrompt(
    colorData.dominantColors,
    colorData.colorTemperature,
    colorData.saturation,
    colorData.contrast
  );

  // First attempt
  let result = await callClaude(anthropic, imageBlocks, userPrompt);

  // Retry once with stricter prompt if first attempt fails
  if (!result) {
    const strictPrompt =
      userPrompt +
      "\n\nCRITICAL: Return ONLY the JSON object. No prose, no markdown, no code fences. Start your response with { and end with }";
    result = await callClaude(anthropic, imageBlocks, strictPrompt);
  }

  if (!result) {
    throw new Error(
      "AI analysis returned an unexpected response. Please try again."
    );
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function selectFrames(framePaths: string[], count: number): string[] {
  if (framePaths.length <= count) return framePaths;
  const step = (framePaths.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    framePaths[Math.round(i * step)]
  );
}

async function callClaude(
  anthropic: Anthropic,
  imageBlocks: Anthropic.ImageBlockParam[],
  textPrompt: string
): Promise<ThemeAnalysisResponse | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: THEME_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text" as const, text: textPrompt },
          ],
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") return null;

    const raw = block.text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    const parsed = JSON.parse(raw) as ThemeAnalysisResponse;
    return parsed;
  } catch {
    return null;
  }
}
