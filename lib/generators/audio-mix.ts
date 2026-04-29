/**
 * Audio mixing via FFmpeg (fluent-ffmpeg).
 *
 * Combines:
 *   - Dialogue tracks (with per-line timing offsets)
 *   - Music track (trimmed, faded, attenuated under dialogue)
 *   - Optional ambient layer
 *
 * Outputs per shot:
 *   - full-mix.mp3  — dialogue + music combined
 *   - dialogue-stem.mp3 — dialogue only
 *   - music-stem.mp3    — music only (trimmed + faded)
 *
 * All outputs are uploaded to R2 and the R2 keys are returned.
 * Temp files are always cleaned up, even on failure.
 */

import pathModule from "path";
import os from "os";
import fs from "fs/promises";
import { copyFileSync } from "fs";
import { downloadFromR2, storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MixDialogueLine {
  r2Key: string;
  startTimeSec: number;
  durationSec: number;
}

export interface MixInput {
  dialogueLines: MixDialogueLine[];
  musicR2Key: string | null;     // null = no music
  musicSourceUrl: string | null; // fallback if R2 key absent
  musicStartPointSec: number;
  musicFadeInSec: number;
  musicFadeOutSec: number;
  musicVolumeDb: number;         // negative = quieter (e.g. -12)
  totalDurationSec: number;
}

export interface MixOutput {
  fullMixR2Key: string;
  dialogueStemR2Key: string;
  musicStemR2Key: string | null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function mixSceneAudio(
  sceneId: string,
  shotId: string,
  input: MixInput
): Promise<MixOutput> {
  const tmpDir = await fs.mkdtemp(pathModule.join(os.tmpdir(), "clip-mix-"));
  try {
    return await runMix(sceneId, shotId, input, tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Core mix logic ───────────────────────────────────────────────────────────

async function runMix(
  sceneId: string,
  shotId: string,
  input: MixInput,
  tmpDir: string
): Promise<MixOutput> {
  const ffmpeg = await loadFfmpeg();
  const scene = await db.scene.findUnique({
    where: { id: sceneId },
    include: { project: { select: { projectSlug: true, name: true } } },
  });
  const projectSlug = scene?.project.projectSlug ?? slugify(scene?.project.name ?? "project");
  const basePath = `${projectSlug}/03_scenes/sc${String(scene?.sceneNumber ?? 1).padStart(2, "0")}/audio/shot_${shotId}`;

  // ── Download dialogue tracks ──
  const dlLocalPaths: Array<{ path: string; startTimeSec: number }> = [];
  for (let i = 0; i < input.dialogueLines.length; i++) {
    const line = input.dialogueLines[i];
    const localPath = pathModule.join(tmpDir, `dl-${i}.mp3`);
    const buf = await downloadFromR2(line.r2Key);
    await fs.writeFile(localPath, buf);
    dlLocalPaths.push({ path: localPath, startTimeSec: line.startTimeSec });
  }

  // ── Download or resolve music source ──
  let musicLocalPath: string | null = null;
  if (input.musicR2Key) {
    musicLocalPath = pathModule.join(tmpDir, "music.mp3");
    const buf = await downloadFromR2(input.musicR2Key);
    await fs.writeFile(musicLocalPath, buf);
  } else if (input.musicSourceUrl) {
    // Let FFmpeg fetch directly from the URL
    musicLocalPath = input.musicSourceUrl;
  }

  // ── Build dialogue stem ──
  const dialogueStemLocal = pathModule.join(tmpDir, "dialogue-stem.mp3");
  await buildDialogueStem(ffmpeg, dlLocalPaths, input.totalDurationSec, dialogueStemLocal);

  const dialogueStemR2Key = `${basePath}/dialogue-stem.mp3`;
  const dialogueStem = await storage.save(dialogueStemR2Key, await fs.readFile(dialogueStemLocal), "audio/mpeg", { sceneId, shotId, type: "dialogue-stem" });

  // ── Build music stem ──
  let musicStemR2Key: string | null = null;
  let musicStemLocal: string | null = null;

  if (musicLocalPath) {
    musicStemLocal = pathModule.join(tmpDir, "music-stem.mp3");
    await buildMusicStem(
      ffmpeg,
      musicLocalPath,
      input.musicStartPointSec,
      input.totalDurationSec,
      input.musicFadeInSec,
      input.musicFadeOutSec,
      input.musicVolumeDb,
      musicStemLocal
    );
    musicStemR2Key = `${basePath}/music-stem.mp3`;
    const musicStem = await storage.save(musicStemR2Key, await fs.readFile(musicStemLocal), "audio/mpeg", { sceneId, shotId, type: "music-stem" });
    musicStemR2Key = musicStem.path;
  }

  // ── Build full mix ──
  const fullMixLocal = pathModule.join(tmpDir, "full-mix.mp3");
  await buildFullMix(ffmpeg, dialogueStemLocal, musicStemLocal, input.totalDurationSec, fullMixLocal);

  const fullMixR2Key = `${basePath}/full-mix.mp3`;
  const fullMix = await storage.save(fullMixR2Key, await fs.readFile(fullMixLocal), "audio/mpeg", { sceneId, shotId, type: "full-mix" });

  console.log(`[audio-mix] Scene ${sceneId} shot ${shotId} — done`);
  return { fullMixR2Key: fullMix.path, dialogueStemR2Key: dialogueStem.path, musicStemR2Key };
}

// ─── FFmpeg sub-functions ─────────────────────────────────────────────────────

async function loadFfmpeg(): Promise<any> {
  try {
    const mod = require("fluent-ffmpeg"); // dynamic require avoids Next.js bundler issues
    return typeof mod === "function" ? mod : mod.default ?? mod;
  } catch {
    throw new Error(
      "fluent-ffmpeg not found. Run: npm install fluent-ffmpeg @types/fluent-ffmpeg"
    );
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

async function buildDialogueStem(
  ffmpeg: any,
  lines: Array<{ path: string; startTimeSec: number }>,
  totalDurationSec: number,
  outputPath: string
): Promise<void> {
  if (lines.length === 0) {
    // Produce silence for the full scene duration
    const cmd = ffmpeg()
      .input("anullsrc=r=44100:cl=stereo")
      .inputOptions(["-f", "lavfi", "-t", String(totalDurationSec)])
      .outputOptions(["-ac", "2", "-ar", "44100"]);
    await ffmpegRun(cmd, outputPath);
    return;
  }

  if (lines.length === 1) {
    const { path: p, startTimeSec } = lines[0];
    const cmd = ffmpeg()
      .input(p)
      .complexFilter([
        // Pad silence before the line then pad to total duration
        `[0:a]adelay=${Math.round(startTimeSec * 1000)}|${Math.round(startTimeSec * 1000)},apad=whole_dur=${totalDurationSec}[out]`,
      ])
      .outputOptions(["-map", "[out]", "-ac", "2", "-ar", "44100"]);
    await ffmpegRun(cmd, outputPath);
    return;
  }

  // Multiple lines — delay each to its start time then amix
  const cmd = ffmpeg();
  const delayFilters: string[] = [];
  const refs: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    cmd.input(lines[i].path);
    const delayMs = Math.round(lines[i].startTimeSec * 1000);
    delayFilters.push(`[${i}:a]adelay=${delayMs}|${delayMs}[d${i}]`);
    refs.push(`[d${i}]`);
  }

  cmd
    .complexFilter([
      ...delayFilters,
      `${refs.join("")}amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${totalDurationSec}[out]`,
    ])
    .outputOptions(["-map", "[out]", "-ac", "2", "-ar", "44100"]);

  await ffmpegRun(cmd, outputPath);
}

async function buildMusicStem(
  ffmpeg: any,
  musicSource: string, // local path or URL
  startPointSec: number,
  totalDurationSec: number,
  fadeInSec: number,
  fadeOutSec: number,
  volumeDb: number,
  outputPath: string
): Promise<void> {
  // Convert dB to linear multiplier: 0dB=1.0, -12dB≈0.25
  const volLinear = Math.pow(10, volumeDb / 20);
  const fadeOutStart = Math.max(totalDurationSec - fadeOutSec, 0);

  const cmd = ffmpeg()
    .input(musicSource)
    .inputOptions(["-ss", String(startPointSec)])
    .complexFilter([
      `[0:a]` +
        `volume=${volLinear.toFixed(4)},` +
        `afade=t=in:st=0:d=${fadeInSec},` +
        `afade=t=out:st=${fadeOutStart}:d=${fadeOutSec},` +
        `apad=whole_dur=${totalDurationSec}` +
        `[out]`,
    ])
    .outputOptions([
      "-map", "[out]",
      "-ac", "2",
      "-ar", "44100",
      "-t", String(totalDurationSec),
    ]);

  await ffmpegRun(cmd, outputPath);
}

async function buildFullMix(
  ffmpeg: any,
  dialogueStemPath: string,
  musicStemPath: string | null,
  totalDurationSec: number,
  outputPath: string
): Promise<void> {
  if (!musicStemPath) {
    copyFileSync(dialogueStemPath, outputPath);
    return;
  }

  const cmd = ffmpeg()
    .input(dialogueStemPath)
    .input(musicStemPath)
    .complexFilter([`[0:a][1:a]amix=inputs=2:normalize=0[out]`])
    .outputOptions([
      "-map", "[out]",
      "-ac", "2",
      "-ar", "44100",
      "-t", String(totalDurationSec),
    ]);

  await ffmpegRun(cmd, outputPath);
}
