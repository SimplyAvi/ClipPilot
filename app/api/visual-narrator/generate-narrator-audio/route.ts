import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildVoiceSettings, textToSpeech } from "@/lib/voice-client";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

const BodySchema = z.object({
  projectId: z.string().min(1),
  previewSegmentId: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id: parsed.data.projectId },
    include: {
      narratorProfile: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  if (!project.narratorProfile?.voiceId) {
    return NextResponse.json({ data: null, error: "Choose a narrator voice first" }, { status: 422 });
  }

  const segments = parsed.data.previewSegmentId
    ? project.visualSegments.filter((segment) => segment.id === parsed.data.previewSegmentId)
    : project.visualSegments;
  if (segments.length === 0) {
    return NextResponse.json({ data: null, error: "No visual segments found" }, { status: 422 });
  }

  try {
    const pace = normalizePace(project.narratorProfile.pace);
    const range = normalizeRange(project.narratorProfile.emotionalRange);
    const settings = { ...buildVoiceSettings(pace, range), stability: 0.75, similarity_boost: 0.75 };
    const projectSlug = project.projectSlug ?? slugify(project.name);
    let totalDuration = 0;
    const generated: Array<{ segmentId: string; path: string; durationSeconds: number }> = [];

    for (const segment of segments) {
      const text = project.narratorProfile.deliveryStyle
        ? `[${project.narratorProfile.deliveryStyle}] ${segment.stanzaText}`
        : segment.stanzaText;
      const audio = Buffer.from(await textToSpeech(project.narratorProfile.voiceId, text, settings));
      const durationSeconds = estimateDuration(segment.stanzaText, project.narratorProfile.pace);
      const path = `${projectSlug}/narrator/narrator_seg_${String(segment.sortOrder + 1).padStart(2, "0")}_v1.mp3`;
      const stored = await storage.save(path, audio, "audio/mpeg", {
        projectId: project.id,
        segmentId: segment.id,
        provider: "elevenlabs",
      });
      totalDuration += durationSeconds;
      generated.push({ segmentId: segment.id, path: stored.path, durationSeconds });

      if (parsed.data.previewSegmentId) {
        await db.narratorProfile.update({
          where: { projectId: project.id },
          data: { previewAudioPath: stored.path },
        });
      } else {
        await db.visualSegment.update({
          where: { id: segment.id },
          data: { narratorAudioPath: stored.path, durationSeconds },
        });
      }
    }

    return NextResponse.json({ data: { totalNarratorDuration: totalDuration, generated }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Narrator audio generation failed";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

function normalizePace(value: string): "slow" | "normal" | "fast" {
  if (value === "slow") return "slow";
  if (value === "expressive") return "fast";
  return "normal";
}

function normalizeRange(value: string): "restrained" | "moderate" | "expressive" {
  if (value === "low" || value === "restrained") return "restrained";
  if (value === "high" || value === "expressive") return "expressive";
  return "moderate";
}

function estimateDuration(text: string, pace: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wpm = pace === "slow" ? 105 : pace === "expressive" ? 155 : 125;
  return Math.max(1.5, (words / wpm) * 60);
}
