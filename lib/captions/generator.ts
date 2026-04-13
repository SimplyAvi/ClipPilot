/**
 * lib/captions/generator.ts — Phase 9
 *
 * Caption generation from Whisper transcription data.
 * Exports SRT, WebVTT, TikTok JSON, and FFmpeg burn-in.
 */

import path from "path";
import os from "os";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

export interface TranscriptionData {
  language?: string;
  duration?: number;
  segments: WhisperSegment[];
  words?: WhisperWord[];
}

export interface CaptionStyle {
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  position: "bottom" | "top" | "center";
  fontFamily: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 24,
  fontColor: "white",
  backgroundColor: "black@0.5",
  position: "bottom",
  fontFamily: "Arial",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_LINE_CHARS = 42;
const MAX_LINES = 2;

function formatSRTTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVTTTimestamp(seconds: number): string {
  return formatSRTTimestamp(seconds).replace(",", ".");
}

/**
 * Splits a long text into lines of max MAX_LINE_CHARS, at word boundaries.
 * Returns at most MAX_LINES lines; remaining text is dropped (shouldn't happen
 * with reasonable Whisper segments).
 */
function splitToLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (lines.length >= MAX_LINES) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= MAX_LINE_CHARS) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        // Single word longer than limit — truncate
        lines.push(word.slice(0, MAX_LINE_CHARS));
        current = "";
      }
    }
  }
  if (current && lines.length < MAX_LINES) lines.push(current);
  return lines;
}

// ─── SRT ─────────────────────────────────────────────────────────────────────

export function generateSRT(transcription: TranscriptionData): string {
  const blocks: string[] = [];

  transcription.segments.forEach((seg, idx) => {
    const lines = splitToLines(seg.text);
    blocks.push(
      [
        String(idx + 1),
        `${formatSRTTimestamp(seg.start)} --> ${formatSRTTimestamp(seg.end)}`,
        lines.join("\n"),
        "",
      ].join("\n")
    );
  });

  return blocks.join("\n");
}

// ─── WebVTT ──────────────────────────────────────────────────────────────────

export function generateVTT(transcription: TranscriptionData): string {
  const header = "WEBVTT\n\n";
  const blocks: string[] = [];

  transcription.segments.forEach((seg, idx) => {
    const lines = splitToLines(seg.text);
    blocks.push(
      [
        String(idx + 1),
        `${formatVTTTimestamp(seg.start)} --> ${formatVTTTimestamp(seg.end)}`,
        lines.join("\n"),
        "",
      ].join("\n")
    );
  });

  return header + blocks.join("\n");
}

// ─── TikTok captions ─────────────────────────────────────────────────────────

interface TikTokCaptionBlock {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Formats captions as TikTok-compatible JSON.
 * Breaks each Whisper segment into 3-word chunks for fast vertical-video reading.
 */
export function generateTikTokCaptions(transcription: TranscriptionData): {
  version: string;
  captions: TikTokCaptionBlock[];
} {
  const captions: TikTokCaptionBlock[] = [];

  for (const seg of transcription.segments) {
    const words = seg.words ?? buildWordFallback(seg);
    const CHUNK_SIZE = 3;

    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunk = words.slice(i, i + CHUNK_SIZE);
      const text = chunk.map((w) => w.word).join(" ").trim();
      if (!text) continue;

      captions.push({
        startMs: Math.round(chunk[0].start * 1000),
        endMs: Math.round(chunk[chunk.length - 1].end * 1000),
        text,
      });
    }
  }

  return { version: "1.0", captions };
}

/** When Whisper doesn't return word-level data, distribute evenly. */
function buildWordFallback(seg: WhisperSegment): WhisperWord[] {
  const words = seg.text.trim().split(/\s+/);
  const duration = seg.end - seg.start;
  const step = duration / words.length;
  return words.map((word, i) => ({
    word,
    start: seg.start + i * step,
    end: seg.start + (i + 1) * step,
  }));
}

// ─── Burn captions into video ─────────────────────────────────────────────────

/**
 * Uses FFmpeg subtitles filter to burn an SRT file into a video.
 * Returns the path to the output file (placed in the same dir as the input).
 */
export async function burnCaptionsToVideo(
  videoPath: string,
  srtPath: string,
  style: CaptionStyle = DEFAULT_CAPTION_STYLE
): Promise<string> {
  // Position mapping → FFmpeg alignment value (2=bottom-center, 8=top-center, 5=center)
  const alignmentMap: Record<CaptionStyle["position"], number> = {
    bottom: 2,
    top: 8,
    center: 5,
  };
  const alignment = alignmentMap[style.position];

  // Build subtitle style override
  const styleOverride = [
    `Fontname=${style.fontFamily}`,
    `Fontsize=${style.fontSize}`,
    `PrimaryColour=&H00FFFFFF`,   // always white text in ASS colour format
    `BackColour=&H80000000`,       // semi-transparent black background
    `Bold=1`,
    `Alignment=${alignment}`,
    `MarginV=30`,
  ].join(",");

  // Escape the SRT path for the subtitles filter (colons on Windows need escaping)
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const ext = path.extname(videoPath);
  const outPath = videoPath.replace(ext, `_captioned${ext}`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilter(`subtitles='${escapedSrt}':force_style='${styleOverride}'`)
      .outputOptions(["-c:a", "copy"])
      .output(outPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });

  return outPath;
}

// ─── SRT file writer helper ───────────────────────────────────────────────────

/** Write SRT content to a temp file and return its path. */
export async function writeTempSRT(srtContent: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `captions-${Date.now()}.srt`);
  await fs.writeFile(tmpPath, srtContent, "utf-8");
  return tmpPath;
}
