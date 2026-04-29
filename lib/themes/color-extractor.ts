/**
 * lib/themes/color-extractor.ts
 *
 * Extracts color palette and mood from video frames using node-vibrant.
 * Analyzes every other frame to avoid redundancy and aggregates across
 * all analyzed frames to build a representative palette.
 */

// node-vibrant is loaded dynamically to avoid Next.js bundler issues
type VibrantSwatch = { rgb: [number, number, number] } | null;
type VibrantPalette = Record<string, VibrantSwatch>;
interface VibrantLib {
  from: (p: string) => { getPalette: () => Promise<VibrantPalette> };
}

let _Vibrant: VibrantLib | null = null;
async function getVibrant(): Promise<VibrantLib> {
  if (_Vibrant) return _Vibrant;
  const mod = require("node-vibrant/node") as { Vibrant?: VibrantLib; default?: { Vibrant?: VibrantLib } };
  _Vibrant = (mod.Vibrant ?? mod.default?.Vibrant ?? (mod as unknown as VibrantLib));
  return _Vibrant as VibrantLib;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColorPaletteResult {
  dominantColors: string[];       // Top 6 hex values
  colorMood: string;              // Warm / Cool / Neutral
  colorTemperature: "cool" | "neutral" | "warm";
  saturation: "desaturated" | "muted" | "normal" | "vivid";
  contrast: "low" | "medium" | "high";
}

// ─── Hex helpers ──────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return [h * 360, s, l];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("");
}

// ─── Color extraction ─────────────────────────────────────────────────────────

export async function extractColorPalette(
  framePaths: string[]
): Promise<ColorPaletteResult> {
  // Analyze every other frame
  const toAnalyze = framePaths.filter((_, i) => i % 2 === 0);

  const allColors: string[] = [];
  const allLightness: number[] = [];
  const allSaturation: number[] = [];

  const Vibrant = await getVibrant();
  for (const framePath of toAnalyze) {
    try {
      const palette = await Vibrant.from(framePath).getPalette();
      const swatches = [
        palette.Vibrant,
        palette.Muted,
        palette.DarkVibrant,
        palette.DarkMuted,
        palette.LightVibrant,
        palette.LightMuted,
      ].filter(Boolean);

      for (const swatch of swatches) {
        if (!swatch) continue;
        const [r, g, b] = swatch.rgb;
        const hex = rgbToHex(r, g, b);
        allColors.push(hex);
        const [, s, l] = hexToHsl(hex);
        allSaturation.push(s);
        allLightness.push(l);
      }
    } catch {
      // Skip frames that fail (e.g. corrupt JPEG)
    }
  }

  if (!allColors.length) {
    // Fallback if all frames failed
    return {
      dominantColors: ["#808080", "#606060", "#a0a0a0", "#404040", "#c0c0c0", "#202020"],
      colorMood: "Neutral",
      colorTemperature: "neutral",
      saturation: "muted",
      contrast: "medium",
    };
  }

  // Deduplicate and take top 6 most representative colors
  // Simple approach: cluster by frequency — bucket colors and pick most common
  const colorCounts = new Map<string, number>();
  for (const color of allColors) {
    // Round to nearest 16 to bucket similar colors
    const rounded =
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(parseInt(color.slice(i, i + 2), 16) / 16) * 16
        )
        .map((v) => Math.min(255, v).toString(16).padStart(2, "0"))
        .join("");
    colorCounts.set(rounded, (colorCounts.get(rounded) ?? 0) + 1);
  }

  const sorted = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c]) => c);

  // Pad to 6 if fewer unique colors found
  while (sorted.length < 6) {
    sorted.push(allColors[sorted.length % allColors.length] ?? "#808080");
  }

  // Determine color temperature from average hue
  const hues = sorted.map((c) => hexToHsl(c)[0]);
  const avgHue = hues.reduce((a, b) => a + b, 0) / hues.length;
  let colorTemperature: "cool" | "neutral" | "warm";
  if ((avgHue >= 0 && avgHue <= 60) || (avgHue >= 300 && avgHue <= 360)) {
    colorTemperature = "warm";
  } else if (avgHue >= 180 && avgHue <= 270) {
    colorTemperature = "cool";
  } else {
    colorTemperature = "neutral";
  }
  const colorMood = colorTemperature.charAt(0).toUpperCase() + colorTemperature.slice(1);

  // Determine saturation from average saturation
  const avgSat = allSaturation.reduce((a, b) => a + b, 0) / allSaturation.length;
  let saturation: "desaturated" | "muted" | "normal" | "vivid";
  if (avgSat < 0.2) saturation = "desaturated";
  else if (avgSat < 0.4) saturation = "muted";
  else if (avgSat < 0.65) saturation = "normal";
  else saturation = "vivid";

  // Determine contrast from range of lightness values
  const minL = Math.min(...allLightness);
  const maxL = Math.max(...allLightness);
  const lightnessRange = maxL - minL;
  let contrast: "low" | "medium" | "high";
  if (lightnessRange < 0.3) contrast = "low";
  else if (lightnessRange < 0.6) contrast = "medium";
  else contrast = "high";

  return {
    dominantColors: sorted,
    colorMood,
    colorTemperature,
    saturation,
    contrast,
  };
}
