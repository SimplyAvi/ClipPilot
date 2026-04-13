/**
 * lib/thumbnails/generator.ts — Phase 10
 *
 * Generates 3 thumbnail variants (Impact Frame, Character Focus, Mood/Atmosphere)
 * via Replicate image generation + Sharp compositing for text overlays.
 * Resizes to platform specs: YouTube 1280×720, TikTok 1080×1920, Square 1080×1080.
 */

import path from "path";
import os from "os";
import fs from "fs/promises";
import sharp from "sharp";
import { getProviderKey } from "@/lib/provider-keys";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThumbnailTextOptions {
  title: string;
  fontSize: "small" | "medium" | "large";
  textColor: "white" | "yellow" | "black" | "red";
  textPosition: "bottom" | "center" | "top";
  textStyle: "plain" | "bold" | "shadow" | "outline";
}

export interface ThumbnailVariantResult {
  variant: "IMPACT_FRAME" | "CHARACTER_FOCUS" | "MOOD_ATMOSPHERE";
  youtubeBuffer: Buffer;   // 1280×720
  tiktokBuffer: Buffer;    // 1080×1920
  squareBuffer: Buffer;    // 1080×1080
  prompt?: string;
}

export interface ProjectMetadata {
  title: string;
  genre: string;
  tone: string;
  logline?: string;
  characters?: Array<{ name: string; description: string | null }>;
  location?: string;
  timeOfDay?: string;
}

// ─── Platform sizes ────────────────────────────────────────────────────────────

const SIZES = {
  youtube: { width: 1280, height: 720 },
  tiktok: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

// ─── Color maps for genre grading ─────────────────────────────────────────────

function genreColorGrade(genre: string): { tint: [number, number, number]; contrast: number } {
  const g = genre.toLowerCase();
  if (g.includes("thriller") || g.includes("crime")) return { tint: [180, 200, 220], contrast: 1.15 };
  if (g.includes("horror")) return { tint: [160, 140, 140], contrast: 1.3 };
  if (g.includes("drama") || g.includes("romance")) return { tint: [240, 210, 180], contrast: 1.05 };
  if (g.includes("comedy")) return { tint: [220, 230, 200], contrast: 0.95 };
  if (g.includes("action")) return { tint: [200, 190, 170], contrast: 1.2 };
  return { tint: [210, 210, 210], contrast: 1.1 };
}

// ─── Replicate image generation ───────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
// SDXL Lightning (faster, better quality for stills)
const SDXL_VERSION = "7762fd07cf82c948538e41f63f77d685e02b063e37291ef63700d952e2706010";

async function generateImageFromReplicate(prompt: string): Promise<Buffer> {
  const apiKey = await getProviderKey("replicate");
  if (!apiKey) throw new Error("REPLICATE_API_TOKEN is not configured");

  const createRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: SDXL_VERSION,
      input: {
        prompt,
        negative_prompt:
          "text, watermark, logo, real person, celebrity, brand, blurry, low quality, nsfw",
        width: 1280,
        height: 720,
        num_inference_steps: 4,
        guidance_scale: 0,
        scheduler: "K_EULER",
        num_outputs: 1,
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Replicate create failed ${createRes.status}: ${body}`);
  }

  interface ReplicatePrediction {
    id: string;
    status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    output?: string | string[];
    error?: string;
  }

  const prediction: ReplicatePrediction = await createRes.json();

  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 3_000));

    const pollRes = await fetch(`${REPLICATE_API_BASE}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate poll failed ${pollRes.status}`);

    const polled: ReplicatePrediction = await pollRes.json();

    if (polled.status === "succeeded") {
      const output = polled.output;
      const imageUrl = Array.isArray(output) ? output[0] : output;
      if (!imageUrl) throw new Error("Replicate returned no output");
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to download generated image`);
      return Buffer.from(await res.arrayBuffer());
    }

    if (polled.status === "failed" || polled.status === "canceled") {
      throw new Error(`Replicate prediction ${polled.status}: ${polled.error ?? "unknown"}`);
    }
  }

  throw new Error("Replicate image generation timed out");
}

// ─── Sharp text overlay compositing ──────────────────────────────────────────

function fontSizePx(size: "small" | "medium" | "large", width: number): number {
  const base = width / 20;
  if (size === "small") return Math.round(base * 0.7);
  if (size === "large") return Math.round(base * 1.4);
  return Math.round(base);
}

function colorHex(color: "white" | "yellow" | "black" | "red"): string {
  const map = { white: "#FFFFFF", yellow: "#FFD700", black: "#000000", red: "#FF2020" };
  return map[color];
}

/**
 * Composite a title text overlay onto an image buffer using Sharp + SVG.
 * Returns a new Buffer with the overlay applied.
 */
export async function compositeTextOverlay(
  imageBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  options: ThumbnailTextOptions
): Promise<Buffer> {
  const { title, fontSize, textColor, textPosition, textStyle } = options;
  const fs_px = fontSizePx(fontSize, targetWidth);
  const color = colorHex(textColor);
  const isBold = textStyle === "bold" || textStyle === "shadow" || textStyle === "outline";

  // Word-wrap the title — max ~30 chars per line at large size
  const maxChars = Math.floor(targetWidth / (fs_px * 0.6));
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  const lineHeight = fs_px * 1.3;
  const textBlockHeight = lines.length * lineHeight;
  const padding = fs_px * 0.8;
  const gradientHeight = textBlockHeight + padding * 2.5;

  // Y position of the text block
  let textY: number;
  if (textPosition === "top") {
    textY = padding * 2;
  } else if (textPosition === "center") {
    textY = (targetHeight - textBlockHeight) / 2;
  } else {
    // bottom
    textY = targetHeight - textBlockHeight - padding * 2;
  }

  const gradientY = textY - padding;

  // Build shadow/outline filters
  const filterAttr =
    textStyle === "shadow"
      ? `filter="url(#shadow)"`
      : textStyle === "outline"
      ? `stroke="${color === "#FFFFFF" ? "#000000" : "#FFFFFF"}" stroke-width="${Math.round(fs_px * 0.06)}" paint-order="stroke"`
      : "";

  const svgLines = lines
    .map(
      (line, i) =>
        `<text x="${targetWidth / 2}" y="${textY + i * lineHeight + fs_px}" ` +
        `font-family="Arial, sans-serif" font-size="${fs_px}" ` +
        `font-weight="${isBold ? "bold" : "normal"}" ` +
        `fill="${color}" text-anchor="middle" ${filterAttr}>${escapeXml(line)}</text>`
    )
    .join("\n");

  const svg = `<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.75"/>
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="${Math.round(fs_px * 0.05)}" dy="${Math.round(fs_px * 0.05)}"
          stdDeviation="${Math.round(fs_px * 0.08)}" flood-color="black" flood-opacity="0.8"/>
      </filter>
    </defs>
    <rect x="0" y="${gradientY}" width="${targetWidth}" height="${gradientHeight}" fill="url(#grad)"/>
    ${svgLines}
  </svg>`;

  const base = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, { fit: "cover", position: "center" })
    .toBuffer();

  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Genre color grade via Sharp tint ─────────────────────────────────────────

async function applyColorGrade(imageBuffer: Buffer, genre: string): Promise<Buffer> {
  const { tint, contrast } = genreColorGrade(genre);
  // Apply a subtle tint by blending with a colored overlay
  const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <rect width="1280" height="720" fill="rgb(${tint[0]},${tint[1]},${tint[2]})" opacity="0.12"/>
  </svg>`;

  const base = await sharp(imageBuffer)
    .modulate({ saturation: contrast > 1 ? 0.85 : 1.05 })
    .linear(contrast, -(128 * (contrast - 1)))
    .toBuffer();

  return sharp(base)
    .composite([{ input: Buffer.from(tintSvg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ─── Resize to all platform sizes ─────────────────────────────────────────────

async function resizeToAll(
  sourceBuffer: Buffer,
  textOptions: ThumbnailTextOptions
): Promise<{ youtubeBuffer: Buffer; tiktokBuffer: Buffer; squareBuffer: Buffer }> {
  const [youtubeBuffer, tiktokBuffer, squareBuffer] = await Promise.all([
    compositeTextOverlay(sourceBuffer, SIZES.youtube.width, SIZES.youtube.height, textOptions),
    compositeTextOverlay(sourceBuffer, SIZES.tiktok.width, SIZES.tiktok.height, textOptions),
    compositeTextOverlay(sourceBuffer, SIZES.square.width, SIZES.square.height, textOptions),
  ]);
  return { youtubeBuffer, tiktokBuffer, squareBuffer };
}

// ─── Variant A: Impact Frame ──────────────────────────────────────────────────

export async function generateImpactFrame(
  bestFramePath: string,
  metadata: ProjectMetadata,
  textOptions: ThumbnailTextOptions
): Promise<ThumbnailVariantResult> {
  const rawBuffer = await fs.readFile(bestFramePath);
  const graded = await applyColorGrade(rawBuffer, metadata.genre);
  const sizes = await resizeToAll(graded, textOptions);

  return {
    variant: "IMPACT_FRAME",
    ...sizes,
    prompt: `Color-graded frame extract for ${metadata.genre} video "${metadata.title}"`,
  };
}

// ─── Variant B: Character Focus ───────────────────────────────────────────────

export async function generateCharacterFocus(
  metadata: ProjectMetadata,
  textOptions: ThumbnailTextOptions
): Promise<ThumbnailVariantResult> {
  const charDesc =
    metadata.characters && metadata.characters.length > 0
      ? metadata.characters
          .filter((c) => c.description)
          .map((c) => c.description)
          .slice(0, 2)
          .join(", ")
      : "compelling protagonist"

  const prompt =
    `Cinematic close-up portrait thumbnail for a ${metadata.genre} social media video ` +
    `titled '${metadata.title}'. ` +
    `${charDesc}. ` +
    `Emotional expression, ${metadata.tone} mood, dramatic ${metadata.genre.toLowerCase().includes("horror") ? "horror" : "studio"} lighting. ` +
    `No logos, no text, no real people. Fictional character only. Ultra-detailed, thumbnail quality, 4K.`;

  let imageBuffer: Buffer;
  try {
    imageBuffer = await generateImageFromReplicate(prompt);
  } catch {
    // Fall back to solid placeholder if Replicate fails
    imageBuffer = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: { r: 30, g: 30, b: 40 } },
    })
      .jpeg()
      .toBuffer();
  }

  const sizes = await resizeToAll(imageBuffer, textOptions);
  return { variant: "CHARACTER_FOCUS", ...sizes, prompt };
}

// ─── Variant C: Mood/Atmosphere ───────────────────────────────────────────────

export async function generateMoodAtmosphere(
  metadata: ProjectMetadata,
  textOptions: ThumbnailTextOptions
): Promise<ThumbnailVariantResult> {
  const location = metadata.location ?? "dramatic cinematic environment";
  const timeOfDay = metadata.timeOfDay ?? "golden hour";

  const prompt =
    `Atmospheric establishing shot thumbnail for a ${metadata.genre} social media video. ` +
    `${location} setting, ${metadata.tone} emotional tone, cinematic composition, ` +
    `no people, no text, no logos. ` +
    `Dramatic ${timeOfDay} lighting, photorealistic, ultra-detailed, 4K.`;

  let imageBuffer: Buffer;
  try {
    imageBuffer = await generateImageFromReplicate(prompt);
  } catch {
    imageBuffer = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: { r: 20, g: 25, b: 35 } },
    })
      .jpeg()
      .toBuffer();
  }

  const sizes = await resizeToAll(imageBuffer, textOptions);
  return { variant: "MOOD_ATMOSPHERE", ...sizes, prompt };
}
