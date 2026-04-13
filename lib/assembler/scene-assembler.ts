/**
 * Scene Assembly — Phase 7
 *
 * Concatenates all COMPLETE shots in a scene into a single video file.
 *
 * Pipeline per scene:
 *  1. Download each shot's best video (lip-synced > generated)
 *  2. Concatenate with the chosen transition (hard-cut | dissolve | fade)
 *  3. Mix in the pre-built audio stem (shot.mixedAudioPath or
 *     scene-level dialogue-stem when per-shot mix is absent)
 *  4. Apply a basic cinematic color grade via FFmpeg curves filter
 *     (acts as a soft LUT — lifts blacks, slight saturation boost)
 *  5. Upload assembled scene video to R2
 *
 * Hard-cut: uses the concat demuxer (frame-accurate, fast).
 * Dissolve / fade: uses the xfade filter (re-encodes, slower).
 *
 * Returns the R2 key of the assembled scene video.
 */

import pathModule from "path";
import os from "os";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { downloadFromR2, uploadToR2 } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransitionType = "cut" | "dissolve" | "fade";

export interface SceneAssemblyInput {
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  shots: SceneShotInput[];
  transition?: TransitionType;
  applyColorGrade?: boolean;
}

export interface SceneShotInput {
  shotId: string;
  shotNumber: number;
  /** Prefer lip-synced video; fall back to raw generated video. */
  lipSyncedVideoPath: string | null;
  generatedVideoPath: string | null;
  mixedAudioPath: string | null;
  duration: number; // seconds
}

export interface SceneAssemblyResult {
  sceneVideoR2Key: string;
  durationSec: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSITION_DURATION = 0.5; // seconds for xfade

// Cinematic color grade via FFmpeg curves:
// - Lift blacks slightly (shadow detail)
// - Slight warm tone in mids
// - Clamp highlights
const COLOR_GRADE_FILTER =
  "curves=r='0/0.05 0.5/0.55 1/0.95':g='0/0.02 0.5/0.5 1/0.98':b='0/0.05 0.5/0.48 1/0.93'";

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function assembleScene(
  input: SceneAssemblyInput
): Promise<SceneAssemblyResult> {
  const tmpDir = await fs.mkdtemp(
    pathModule.join(os.tmpdir(), `clip-scene-${input.sceneNumber}-`)
  );
  try {
    return await runAssembly(input, tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Core assembly ────────────────────────────────────────────────────────────

async function runAssembly(
  input: SceneAssemblyInput,
  tmpDir: string
): Promise<SceneAssemblyResult> {
  const ffmpeg = await loadFfmpeg();
  const {
    projectId,
    sceneId,
    sceneNumber,
    shots,
    transition = "cut",
    applyColorGrade = true,
  } = input;

  // Filter to shots that have a usable video
  const usableShots = shots
    .filter((s) => s.lipSyncedVideoPath || s.generatedVideoPath)
    .sort((a, b) => a.shotNumber - b.shotNumber);

  if (usableShots.length === 0) {
    throw new Error(`Scene ${sceneNumber}: no complete shots to assemble`);
  }

  // Download shot videos
  const localVideos: string[] = [];
  for (let i = 0; i < usableShots.length; i++) {
    const shot = usableShots[i];
    const r2Key = shot.lipSyncedVideoPath ?? shot.generatedVideoPath!;
    const localPath = pathModule.join(tmpDir, `shot-${i}.mp4`);
    const buf = await downloadFromR2(r2Key);
    await fs.writeFile(localPath, buf);
    localVideos.push(localPath);
  }

  // Concatenate video track
  const concatVideoPath = pathModule.join(tmpDir, "concat-video.mp4");
  if (transition === "cut") {
    await concatHardCut(ffmpeg, localVideos, concatVideoPath);
  } else {
    await concatXfade(ffmpeg, localVideos, usableShots.map((s) => s.duration), transition, concatVideoPath);
  }

  // Build mixed audio for the scene (concat per-shot mixed audio)
  const sceneAudioPath = pathModule.join(tmpDir, "scene-audio.mp3");
  const shotAudioPaths: string[] = [];
  for (let i = 0; i < usableShots.length; i++) {
    const shot = usableShots[i];
    if (shot.mixedAudioPath) {
      const localPath = pathModule.join(tmpDir, `audio-${i}.mp3`);
      const buf = await downloadFromR2(shot.mixedAudioPath);
      await fs.writeFile(localPath, buf);
      shotAudioPaths.push(localPath);
    }
  }

  const hasAudio = shotAudioPaths.length > 0;
  if (hasAudio) {
    await concatAudio(ffmpeg, shotAudioPaths, sceneAudioPath);
  }

  // Combine video + audio, apply color grade
  const outputPath = pathModule.join(tmpDir, "scene-output.mp4");
  await muxAndGrade(ffmpeg, concatVideoPath, hasAudio ? sceneAudioPath : null, applyColorGrade, outputPath);

  const totalDuration = usableShots.reduce((sum, s) => sum + s.duration, 0);
  const r2Key = `projects/${projectId}/assembly/scenes/scene-${sceneNumber}.mp4`;
  const buf = await fs.readFile(outputPath);
  await uploadToR2(r2Key, buf, "video/mp4");

  console.log(`[scene-assembler] Scene ${sceneNumber} assembled → ${r2Key}`);
  return { sceneVideoR2Key: r2Key, durationSec: totalDuration };
}

// ─── FFmpeg helpers ───────────────────────────────────────────────────────────

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

/** Hard-cut concat via a concat list file (fast, no re-encode for video track). */
async function concatHardCut(
  ffmpeg: any,
  localVideos: string[],
  outputPath: string
): Promise<void> {
  if (localVideos.length === 1) {
    // Single shot — just copy
    const buf = await fs.readFile(localVideos[0]);
    await fs.writeFile(outputPath, buf);
    return;
  }

  // Write concat list
  const listPath = pathModule.join(pathModule.dirname(outputPath), "concat.txt");
  const listContent = localVideos.map((p) => `file '${p}'`).join("\n");
  await fs.writeFile(listPath, listContent);

  const cmd = ffmpeg()
    .input(listPath)
    .inputOptions(["-f", "concat", "-safe", "0"])
    .outputOptions(["-c", "copy"]);
  await ffmpegRun(cmd, outputPath);
}

/** Crossfade/dissolve concat via xfade filter (requires re-encode). */
async function concatXfade(
  ffmpeg: any,
  localVideos: string[],
  durations: number[],
  transition: TransitionType,
  outputPath: string
): Promise<void> {
  if (localVideos.length === 1) {
    const buf = await fs.readFile(localVideos[0]);
    await fs.writeFile(outputPath, buf);
    return;
  }

  const xfadeType = transition === "fade" ? "fade" : "dissolve";
  const cmd = ffmpeg();
  localVideos.forEach((v) => cmd.input(v));

  // Build xfade filter chain
  let filterStr = "";
  let lastOut = "[0:v]";
  let offset = 0;

  for (let i = 1; i < localVideos.length; i++) {
    offset += durations[i - 1] - TRANSITION_DURATION;
    const outLabel = i === localVideos.length - 1 ? "[vout]" : `[v${i}]`;
    filterStr += `${lastOut}[${i}:v]xfade=transition=${xfadeType}:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(3)}${outLabel}`;
    if (i < localVideos.length - 1) filterStr += ";";
    lastOut = `[v${i}]`;
  }

  cmd
    .complexFilter([filterStr])
    .outputOptions(["-map", "[vout]", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an"]);
  await ffmpegRun(cmd, outputPath);
}

/** Concatenate per-shot audio files into one scene audio track. */
async function concatAudio(
  ffmpeg: any,
  audioPaths: string[],
  outputPath: string
): Promise<void> {
  if (audioPaths.length === 1) {
    const buf = await fs.readFile(audioPaths[0]);
    await fs.writeFile(outputPath, buf);
    return;
  }

  const listPath = pathModule.join(pathModule.dirname(outputPath), "audio-concat.txt");
  await fs.writeFile(listPath, audioPaths.map((p) => `file '${p}'`).join("\n"));

  const cmd = ffmpeg()
    .input(listPath)
    .inputOptions(["-f", "concat", "-safe", "0"])
    .outputOptions(["-c", "copy"]);
  await ffmpegRun(cmd, outputPath);
}

/** Mux video + optional audio, apply color grade curves. */
async function muxAndGrade(
  ffmpeg: any,
  videoPath: string,
  audioPath: string | null,
  applyColorGrade: boolean,
  outputPath: string
): Promise<void> {
  const cmd = ffmpeg().input(videoPath);
  if (audioPath) cmd.input(audioPath);

  const videoFilter = applyColorGrade ? COLOR_GRADE_FILTER : "null";

  const outputOpts = [
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
  ];

  if (audioPath) {
    cmd
      .complexFilter([[`[0:v]${videoFilter}[vout]`]])
      .outputOptions(["-map", "[vout]", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", ...outputOpts]);
  } else {
    cmd
      .complexFilter([[`[0:v]${videoFilter}[vout]`]])
      .outputOptions(["-map", "[vout]", "-an", ...outputOpts]);
  }

  await ffmpegRun(cmd, outputPath);
}
