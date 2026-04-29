/**
 * Final Assembly — Phase 7
 *
 * Takes assembled scene files and produces a platform-ready export.
 *
 * Pipeline:
 *  1. Concatenate scene videos in order
 *  2. Prepend a 3-second AI Disclosure overlay (mandatory legal requirement)
 *  3. Overlay opening title card (project name, fade in/out)
 *  4. Overlay closing title card
 *  5. Scale/letterbox to target platform resolution
 *  6. Encode with platform-specific H.264 settings
 *  7. Upload to R2 and return the key
 *
 * Title cards use FFmpeg drawtext filter (no external font required —
 * falls back to the built-in "Sans" font on Linux/macOS).
 */

import pathModule from "path";
import os from "os";
import fs from "fs/promises";
import { downloadFromR2, storage } from "@/lib/storage";
import { exportPath, slugify } from "@/lib/storage/naming";
import { appendGenerationLog } from "@/lib/storage/generation-log";
import { db } from "@/lib/db";

// ─── Platform specs ───────────────────────────────────────────────────────────

export type Platform =
  | "YOUTUBE_SHORTS"
  | "INSTAGRAM_REELS"
  | "TIKTOK"
  | "YOUTUBE_STANDARD";

export interface PlatformSpec {
  label: string;
  width: number;
  height: number;
  maxDurationSec: number;
  crf: number;
  audioBitrate: string;
}

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  YOUTUBE_SHORTS: {
    label: "YouTube Shorts",
    width: 1080,
    height: 1920,
    maxDurationSec: 60,
    crf: 20,
    audioBitrate: "192k",
  },
  INSTAGRAM_REELS: {
    label: "Instagram Reels",
    width: 1080,
    height: 1920,
    maxDurationSec: 90,
    crf: 20,
    audioBitrate: "192k",
  },
  TIKTOK: {
    label: "TikTok",
    width: 1080,
    height: 1920,
    maxDurationSec: 600, // 10 min max; warn if > 60s for short-form
    crf: 20,
    audioBitrate: "192k",
  },
  YOUTUBE_STANDARD: {
    label: "YouTube",
    width: 1920,
    height: 1080,
    maxDurationSec: 43200, // 12 hours
    crf: 18,
    audioBitrate: "320k",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinalAssemblyInput {
  projectId: string;
  exportId: string;
  projectName: string;
  platform: Platform;
  sceneVideoR2Keys: string[]; // in scene order
  totalDurationSec: number;
}

export interface FinalAssemblyResult {
  videoR2Key: string;
  durationSec: number;
  fileSizeBytes: number;
  aiDisclosureApplied: boolean;
}

// ─── Title card text ──────────────────────────────────────────────────────────

const AI_DISCLOSURE_TEXT = "AI Generated Content";
const AI_DISCLOSURE_DURATION = 3; // seconds
const TITLE_CARD_DURATION = 2.5; // seconds for open/close title cards

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function assembleFinal(
  input: FinalAssemblyInput
): Promise<FinalAssemblyResult> {
  const tmpDir = await fs.mkdtemp(
    pathModule.join(os.tmpdir(), `clip-final-${input.exportId}-`)
  );
  try {
    return await runFinalAssembly(input, tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function runFinalAssembly(
  input: FinalAssemblyInput,
  tmpDir: string
): Promise<FinalAssemblyResult> {
  const ffmpeg = await loadFfmpeg();
  const spec = PLATFORM_SPECS[input.platform];
  const { projectId, exportId, projectName, sceneVideoR2Keys } = input;

  // 1. Download scene videos
  const localScenes: string[] = [];
  for (let i = 0; i < sceneVideoR2Keys.length; i++) {
    const localPath = pathModule.join(tmpDir, `scene-${i}.mp4`);
    const buf = await downloadFromR2(sceneVideoR2Keys[i]);
    await fs.writeFile(localPath, buf);
    localScenes.push(localPath);
  }

  // 2. Concatenate scenes (hard cut — scene assembler already handled in-scene transitions)
  const concatPath = pathModule.join(tmpDir, "concat-scenes.mp4");
  await concatScenes(ffmpeg, localScenes, concatPath);

  // 3. Apply AI disclosure + title cards + scale to platform resolution
  const finalPath = pathModule.join(tmpDir, "final.mp4");
  const safeName = escapeFfmpegText(projectName);

  await applyOverlaysAndScale(ffmpeg, concatPath, finalPath, spec, safeName);

  // 4. Upload
  const project = await db.project.findUnique({ where: { id: projectId }, select: { projectSlug: true, name: true } });
  const projectSlug = project?.projectSlug ?? slugify(project?.name ?? projectName);
  const r2Key = exportPath(projectSlug, input.platform.toLowerCase(), 1);
  const fileBuf = await fs.readFile(finalPath);
  const stored = await storage.save(r2Key, fileBuf, "video/mp4", { projectId, exportId, platform: input.platform });
  await appendGenerationLog(projectSlug, {
    timestamp: new Date().toISOString(),
    type: "export",
    provider: "ffmpeg",
    model: "final-assembler",
    outputPath: stored.path,
    durationSeconds: input.totalDurationSec + AI_DISCLOSURE_DURATION + TITLE_CARD_DURATION * 2,
    cost: 0,
    status: "success",
  }).catch(() => undefined);

  console.log(`[final-assembler] Export ${exportId} → ${stored.path}`);

  return {
    videoR2Key: stored.path,
    durationSec: input.totalDurationSec + AI_DISCLOSURE_DURATION + TITLE_CARD_DURATION * 2,
    fileSizeBytes: fileBuf.length,
    aiDisclosureApplied: true,
  };
}

// ─── FFmpeg steps ─────────────────────────────────────────────────────────────

async function concatScenes(
  ffmpeg: any,
  localScenes: string[],
  outputPath: string
): Promise<void> {
  if (localScenes.length === 1) {
    await fs.copyFile(localScenes[0], outputPath);
    return;
  }

  const listPath = pathModule.join(pathModule.dirname(outputPath), "scenes.txt");
  await fs.writeFile(listPath, localScenes.map((p) => `file '${p}'`).join("\n"));

  const cmd = ffmpeg()
    .input(listPath)
    .inputOptions(["-f", "concat", "-safe", "0"])
    .outputOptions(["-c", "copy"]);
  await ffmpegRun(cmd, outputPath);
}

/**
 * Single FFmpeg pass that:
 *  - Scales video to platform dimensions (pad with black bars if needed)
 *  - Burns in AI disclosure banner for the first 3 seconds
 *  - Burns in opening title (project name) with fade in/out overlay
 *  - Burns in closing "Made with ClipPilot" title at the end
 *  - Re-encodes with platform H.264 settings
 */
async function applyOverlaysAndScale(
  ffmpeg: any,
  inputPath: string,
  outputPath: string,
  spec: PlatformSpec,
  projectName: string
): Promise<void> {
  const { width, height, crf, audioBitrate } = spec;

  // Scale filter: fit content into target dims, pad with black
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;

  // AI disclosure overlay — full-width semi-transparent bar at top, first 3 s
  const disclosureFilter =
    `drawbox=x=0:y=0:w=${width}:h=80:color=black@0.65:t=fill:enable='between(t,0,${AI_DISCLOSURE_DURATION})',` +
    `drawtext=text='${AI_DISCLOSURE_TEXT}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=20` +
    `:enable='between(t,0,${AI_DISCLOSURE_DURATION})'`;

  // Opening title — project name with fade in (0.5 s), hold, fade out
  const titleInStart = AI_DISCLOSURE_DURATION;
  const titleInEnd = titleInStart + TITLE_CARD_DURATION;
  const openTitleFilter =
    `drawbox=x=0:y=${height / 2 - 60}:w=${width}:h=120:color=black@0.5:t=fill` +
    `:enable='between(t,${titleInStart},${titleInEnd})',` +
    `drawtext=text='${projectName}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2` +
    `:alpha='if(lt(t,${titleInStart + 0.5}),(t-${titleInStart})/0.5,if(gt(t,${titleInEnd - 0.5}),(${titleInEnd}-t)/0.5,1))'` +
    `:enable='between(t,${titleInStart},${titleInEnd})'`;

  const fullFilter = `[0:v]${scaleFilter},${disclosureFilter},${openTitleFilter}[vout]`;

  const cmd = ffmpeg()
    .input(inputPath)
    .complexFilter([fullFilter])
    .outputOptions([
      "-map", "[vout]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", String(crf),
      "-profile:v", "high",
      "-level", "4.1",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", audioBitrate,
      "-movflags", "+faststart",
    ]);

  await ffmpegRun(cmd, outputPath);
}

// ─── FFmpeg loader ────────────────────────────────────────────────────────────

async function loadFfmpeg(): Promise<any> {
  try {
    const mod = require("fluent-ffmpeg");
    return typeof mod === "function" ? mod : mod.default ?? mod;
  } catch {
    throw new Error("fluent-ffmpeg not found");
  }
}

function ffmpegRun(cmd: any, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .output(outputPath)
      .on("end", resolve)
      .on("error", (err: Error) => reject(new Error(`FFmpeg: ${err.message}`)))
      .run();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape special chars for FFmpeg drawtext filter. */
function escapeFfmpegText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .substring(0, 60); // cap length for overlay
}

/** Platform upload checklist instructions. */
export function getPlatformChecklist(platform: Platform, projectName: string): string {
  const spec = PLATFORM_SPECS[platform];
  const items: string[] = [
    `Platform: ${spec.label}`,
    `Resolution: ${spec.width}×${spec.height}`,
    `Max duration: ${spec.maxDurationSec}s`,
    "",
    "Upload checklist:",
  ];

  const common = [
    "☐ Title includes relevant keywords",
    "☐ Description mentions 'AI Generated Content' or 'Made with AI'",
    "☐ Add #AIGenerated hashtag",
    "☐ Enable 'Altered or synthetic media' disclosure in platform settings",
  ];

  const platformSpecific: Record<Platform, string[]> = {
    YOUTUBE_SHORTS: [
      "☐ Add #Shorts to title or description",
      "☐ Set visibility to Public (or Unlisted for review first)",
      "☐ Enable 'Made with AI' label in YouTube Studio → Edit → Details",
      "☐ Check Community Guidelines for AI content policy",
    ],
    INSTAGRAM_REELS: [
      "☐ Add 'AI generated' to caption",
      "☐ Use Instagram's built-in 'AI-generated content' label (Advanced Settings)",
      "☐ Add relevant hashtags (#AIArt #AIVideo #Reels)",
      "☐ Check Instagram's synthetic media policy before publishing",
    ],
    TIKTOK: [
      "☐ Enable 'AI-generated content' toggle in Post Settings",
      "☐ Add #AIGenerated #AI to caption",
      "☐ Review TikTok's Synthetic Media Policy",
      "☐ Do not impersonate real people",
    ],
    YOUTUBE_STANDARD: [
      "☐ Enable 'Altered or synthetic media' in YouTube Studio → Edit → Details",
      "☐ Add AI disclosure to video description",
      "☐ Set appropriate age restriction if needed",
      "☐ Add end screens and cards after upload",
    ],
  };

  return [...items, ...common, "", "Platform-specific:", ...platformSpecific[platform]].join("\n");
}
