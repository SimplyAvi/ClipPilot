/**
 * POST /api/captions/transcribe
 *
 * Transcribes the project's final mixed audio using OpenAI Whisper,
 * saves segments to the DB, and returns the transcription data.
 *
 * Body: { projectId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI, { toFile } from "openai";
import path from "path";
import os from "os";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { db } from "@/lib/db";
import { getProviderKey } from "@/lib/provider-keys";
import { downloadFromR2 } from "@/lib/storage";
import type { TranscriptionData, WhisperSegment, WhisperWord } from "@/lib/captions/generator";

const BodySchema = z.object({
  projectId: z.string().min(1),
});

// ─── Helper: convert any audio to WAV via FFmpeg ──────────────────────────────

async function convertToWav(inputPath: string): Promise<string> {
  const wavPath = inputPath.replace(path.extname(inputPath), "_converted.wav");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .output(wavPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
  return wavPath;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Parse & validate body
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { projectId } = body;

  // 2. Check OpenAI key
  const openAiKey = await getProviderKey("openai");
  if (!openAiKey) {
    return NextResponse.json(
      {
        error:
          "Add OpenAI API key in Settings to enable transcription",
        settingsLink: "/settings",
      },
      { status: 422 }
    );
  }

  // 3. Find the project's final mixed audio
  // We look for the most recent shot with a mixedAudioPath in any of the project's scenes.
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: {
        orderBy: { createdAt: "asc" },
        include: {
          shots: {
            where: { mixedAudioPath: { not: null } },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Collect all shot audio paths in scene order
  const audioKeys: string[] = [];
  for (const scene of project.scenes) {
    for (const shot of scene.shots) {
      if (shot.mixedAudioPath) audioKeys.push(shot.mixedAudioPath);
    }
  }

  if (audioKeys.length === 0) {
    return NextResponse.json(
      {
        error:
          "Generate and approve the audio mix in Phase 6 before running transcription",
      },
      { status: 422 }
    );
  }

  // 4. Download and merge audio files into a single temp file
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cp-transcribe-"));
  const mergedPath = path.join(tmpDir, "merged.mp3");

  try {
    if (audioKeys.length === 1) {
      // Single audio — download directly
      const buf = await downloadFromR2(audioKeys[0]);
      await fs.writeFile(mergedPath, buf);
    } else {
      // Multiple audio files — concat with FFmpeg
      const localPaths: string[] = [];
      for (let i = 0; i < audioKeys.length; i++) {
        const buf = await downloadFromR2(audioKeys[i]);
        const p = path.join(tmpDir, `shot-${i}.mp3`);
        await fs.writeFile(p, buf);
        localPaths.push(p);
      }

      const listFile = path.join(tmpDir, "concat.txt");
      await fs.writeFile(
        listFile,
        localPaths.map((p) => `file '${p}'`).join("\n"),
        "utf-8"
      );

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listFile)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .audioCodec("copy")
          .output(mergedPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
    }

    // 5. Call Whisper API
    const openai = new OpenAI({ apiKey: openAiKey });
    let audioPath = mergedPath;

    interface WhisperVerboseResponse {
      language: string;
      duration: number;
      segments: Array<{
        id: number;
        start: number;
        end: number;
        text: string;
        words?: Array<{ word: string; start: number; end: number }>;
      }>;
      words?: Array<{ word: string; start: number; end: number }>;
    }

    let whisperResult: WhisperVerboseResponse;
    try {
      const fileBuffer = await fs.readFile(audioPath);
      const audioFile = await toFile(fileBuffer, "audio.mp3", { type: "audio/mpeg" });

      const result = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
      });
      whisperResult = result as unknown as WhisperVerboseResponse;
    } catch (whisperErr) {
      // Auto-convert to WAV and retry once
      try {
        audioPath = await convertToWav(mergedPath);
        const fileBuffer = await fs.readFile(audioPath);
        const audioFile = await toFile(fileBuffer, "audio.wav", { type: "audio/wav" });
        const result = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          response_format: "verbose_json",
          timestamp_granularities: ["word", "segment"],
        });
        whisperResult = result as unknown as WhisperVerboseResponse;
      } catch {
        throw whisperErr; // surface original error
      }
    }

    // 6. Validate result
    if (!whisperResult.segments || whisperResult.segments.length === 0) {
      return NextResponse.json(
        {
          error:
            "No speech detected in this audio. Check that dialogue was included in the mix.",
        },
        { status: 422 }
      );
    }

    const transcriptionData: TranscriptionData = {
      language: whisperResult.language,
      duration: whisperResult.duration,
      segments: whisperResult.segments.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        words: s.words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
      })),
      words: whisperResult.words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
    };

    // 7. Save to DB (upsert so re-running replaces the previous transcription)
    const existing = await db.transcription.findUnique({ where: { projectId } });

    if (existing) {
      // Delete old segments
      await db.captionSegment.deleteMany({ where: { transcriptionId: existing.id } });
      // Update transcription record
      const updated = await db.transcription.update({
        where: { projectId },
        data: {
          language: transcriptionData.language ?? null,
          durationSec: transcriptionData.duration ?? null,
          rawResponse: JSON.parse(JSON.stringify(whisperResult)),
          segments: {
            create: transcriptionData.segments.map((seg, idx) => ({
              index: idx,
              startSec: seg.start,
              endSec: seg.end,
              text: seg.text,
            })),
          },
        },
        include: { segments: { orderBy: { index: "asc" } } },
      });
      return NextResponse.json({ data: { transcription: updated, parsed: transcriptionData } });
    } else {
      const created = await db.transcription.create({
        data: {
          projectId,
          language: transcriptionData.language ?? null,
          durationSec: transcriptionData.duration ?? null,
          rawResponse: JSON.parse(JSON.stringify(whisperResult)),
          segments: {
            create: transcriptionData.segments.map((seg, idx) => ({
              index: idx,
              startSec: seg.start,
              endSec: seg.end,
              text: seg.text,
            })),
          },
        },
        include: { segments: { orderBy: { index: "asc" } } },
      });
      return NextResponse.json({ data: { transcription: created, parsed: transcriptionData } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Always clean up temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
