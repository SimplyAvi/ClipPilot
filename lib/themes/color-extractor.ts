/**
 * lib/themes/color-extractor.ts
 *
 * Extracts color palette and mood from video frames using sharp.
 * Sharp is a native C++ module — no webpack bundling issues.
 * Analyzes every other frame to avoid redundancy and aggregates across
 * all analyzed frames to build a representative palette.
 */

import sharp from "sharp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColorPaletteResult {
  dominantColors: string[];       // Top 6 hex values
  colorMood: string;              // Warm / Cool / Neutral
  colorTemperature: "cool" | "neutral" | "warm";
  saturation: "desaturated" | "muted" | "normal" | "vivid";
  contrast: "low" | "medium" | "high";
}

// ─── Hex / HSL helpers ────────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    case bn: h = ((rn - gn) / d + 4) / 6; break;
  }

  return [h * 360, s, l];
}

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return rgbToHsl(r, g, b);
}

// ─── Per-frame pixel sampling ─────────────────────────────────────────────────

async function sampleFramePixels(
  framePath: string
): Promise<Array<[number, number, number]>> {
  // Resize to 64×64 for fast processing — enough to capture color palette
  const { data } = await sharp(framePath)
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: Array<[number, number, number]> = [];
  for (let i = 0; i + 2 < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

// ─── Color extraction ─────────────────────────────────────────────────────────

export async function extractColorPalette(
  framePaths: string[]
): Promise<ColorPaletteResult> {
  // Analyze every other frame
  const toAnalyze = framePaths.filter((_, i) => i % 2 === 0);

  const allHues: number[] = [];
  const allSaturations: number[] = [];
  const allLightnesses: number[] = [];

  // Bucket map for dominant color extraction (round RGB to nearest 32)
  const bucketCounts = new Map<string, number>();

  for (const framePath of toAnalyze) {
    try {
      const pixels = await sampleFramePixels(framePath);
      for (const [r, g, b] of pixels) {
        const [h, s, l] = rgbToHsl(r, g, b);
        allHues.push(h);
        allSaturations.push(s);
        allLightnesses.push(l);

        // Round each channel to nearest 32 to bucket similar colors
        const br = Math.min(255, Math.round(r / 32) * 32);
        const bg = Math.min(255, Math.round(g / 32) * 32);
        const bb = Math.min(255, Math.round(b / 32) * 32);
        const key = rgbToHex(br, bg, bb);
        bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
      }
    } catch {
      // Skip frames that fail (e.g. corrupt JPEG)
    }
  }

  if (allHues.length === 0) {
    // Fallback if all frames failed
    return {
      dominantColors: ["#808080", "#606060", "#a0a0a0", "#404040", "#c0c0c0", "#202020"],
      colorMood: "Neutral",
      colorTemperature: "neutral",
      saturation: "muted",
      contrast: "medium",
    };
  }

  // Pick top 6 most-common color buckets
  const sorted = Array.from(bucketCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);

  while (sorted.length < 6) {
    sorted.push("#808080");
  }

  // Color temperature from average hue
  const avgHue = allHues.reduce((a, b) => a + b, 0) / allHues.length;
  let colorTemperature: "cool" | "neutral" | "warm";
  if ((avgHue >= 0 && avgHue <= 60) || (avgHue >= 300 && avgHue <= 360)) {
    colorTemperature = "warm";
  } else if (avgHue >= 180 && avgHue <= 270) {
    colorTemperature = "cool";
  } else {
    colorTemperature = "neutral";
  }
  const colorMood =
    colorTemperature.charAt(0).toUpperCase() + colorTemperature.slice(1);

  // Saturation from average saturation
  const avgSat =
    allSaturations.reduce((a, b) => a + b, 0) / allSaturations.length;
  let saturation: "desaturated" | "muted" | "normal" | "vivid";
  if (avgSat < 0.2) saturation = "desaturated";
  else if (avgSat < 0.4) saturation = "muted";
  else if (avgSat < 0.65) saturation = "normal";
  else saturation = "vivid";

  // Contrast from lightness range
  const minL = Math.min(...allLightnesses);
  const maxL = Math.max(...allLightnesses);
  const range = maxL - minL;
  let contrast: "low" | "medium" | "high";
  if (range < 0.3) contrast = "low";
  else if (range < 0.6) contrast = "medium";
  else contrast = "high";

  return {
    dominantColors: sorted,
    colorMood,
    colorTemperature,
    saturation,
    contrast,
  };
}
