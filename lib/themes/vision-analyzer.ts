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
    console.warn("[vision-analyzer] attempt 1 failed — retrying with stricter prompt");
    const strictPrompt =
      userPrompt +
      "\n\nCRITICAL: Return ONLY the JSON object. No prose, no markdown, no code fences. Start your response with { and end with }";
    result = await callClaude(anthropic, imageBlocks, strictPrompt, 2);
  }

  if (!result) {
    throw new Error(
      "AI analysis failed after 2 attempts. Check the server logs for the exact error, then try again."
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
  textPrompt: string,
  attempt = 1
): Promise<ThemeAnalysisResponse | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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
    if (block.type !== "text") {
      console.error(`[vision-analyzer] attempt ${attempt}: response block type was "${block.type}", expected "text"`);
      return null;
    }

    const raw = block.text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    try {
      const parsed = JSON.parse(raw) as ThemeAnalysisResponse;
      return parsed;
    } catch (parseErr) {
      console.error(`[vision-analyzer] attempt ${attempt}: JSON parse failed —`, parseErr);
      console.error(`[vision-analyzer] raw response (first 500 chars):`, raw.slice(0, 500));
      return null;
    }
  } catch (apiErr) {
    console.error(`[vision-analyzer] attempt ${attempt}: Anthropic API error —`, apiErr);
    return null;
  }
}
