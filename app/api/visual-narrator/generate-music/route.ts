import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildMubertPrompt, generateMubertTrack, getMubertCredentials } from "@/lib/music/mubert-client";
import { getSignedViewUrl, storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

const BodySchema = z.object({ projectId: z.string().min(1) });

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
      theme: true,
      visualSegments: true,
      projectMusicTrack: true,
    },
  });
  if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

  const totalDuration = project.visualSegments.reduce((sum, segment) => sum + (segment.durationSeconds ?? 8), 0);
  const track = project.projectMusicTrack;
  const promptParts = [
    project.theme?.audioPromptModifier,
    track?.style ?? project.theme?.audioStyle ?? "ambient cinematic",
    track?.mood ?? project.theme?.musicMood ?? project.tone,
    track?.tempo ?? project.theme?.musicTempo,
    track?.primaryInstrument ? `featuring ${track.primaryInstrument}` : "ambient piano and soft textures",
    track?.silenceUsage === "Heavy" ? "quiet sparse room for narration" : "supportive underscore",
  ];
  const mubertPrompt = buildMubertPrompt(promptParts);
  const prompt = [
    project.theme?.audioPromptModifier,
    `Instrumental ${track?.style ?? project.theme?.audioStyle ?? "ambient cinematic"} composition.`,
    `Primary instrument: ${track?.primaryInstrument ?? "ambient piano and soft textures"}.`,
    `Duration: ${Math.round(totalDuration)} seconds.`,
    `Emotional arc: ${track?.emotionalArc ?? "gentle rise and release"}.`,
    track?.silenceUsage === "Heavy"
      ? "Music should drop to near silence at peak emotional moments, letting the narrator carry those sections."
      : "Music should remain present throughout, supporting the narrator.",
    "No vocals, no lyrics. Fade in gently over first 3 seconds. Fade out over final 5 seconds.",
  ].filter(Boolean).join(" ");

  const mubertCredentials = await getMubertCredentials();
  const sunoKey = process.env.SUNO_API_KEY?.trim() || null;

  if (!mubertCredentials && !sunoKey) {
    const updated = await db.projectMusicTrack.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        generationPrompt: prompt,
        durationSeconds: totalDuration,
        status: "manual_upload_needed",
      },
      update: {
        generationPrompt: prompt,
        durationSeconds: totalDuration,
        status: "manual_upload_needed",
      },
    });
    return NextResponse.json({
      data: {
        track: updated,
        manualUploadRequired: true,
        message: "No music generation API connected. Upload a royalty-free track from your Asset Library instead.",
      },
      error: null,
    });
  }

  if (mubertCredentials) {
    const projectSlug = project.projectSlug ?? slugify(project.name);
    const existing = await db.projectMusicTrack.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        generationPrompt: prompt,
        durationSeconds: totalDuration,
        status: "generating",
      },
      update: {
        generationPrompt: prompt,
        durationSeconds: totalDuration,
        status: "generating",
      },
    });

    try {
      const generated = await generateMubertTrack({
        prompt: mubertPrompt,
        durationSeconds: totalDuration || 60,
        intensity: track?.tempo === "Slow" || track?.silenceUsage === "Heavy" ? "low" : "medium",
        format: "mp3",
      });
      const audioRes = await fetch(generated.url);
      if (!audioRes.ok) {
        throw new Error(`Could not download generated music: HTTP ${audioRes.status}`);
      }
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const storagePath = `${projectSlug}/04_music/cues/narrator_score_v1.${generated.extension}`;
      const stored = await storage.save(storagePath, audioBuffer, generated.mimeType, {
        projectId: project.id,
        provider: "mubert",
        mubertTrackId: generated.trackId,
        prompt: mubertPrompt,
      });
      const updated = await db.projectMusicTrack.update({
        where: { id: existing.id },
        data: {
          audioPath: stored.path,
          durationSeconds: generated.durationSeconds,
          generationPrompt: prompt,
          status: "complete",
        },
      });
      const audioUrl = await getSignedViewUrl(stored.path).catch(() => storage.getUrl(stored.path));

      return NextResponse.json({
        data: {
          track: updated,
          audioUrl,
          provider: "mubert",
          providerConnected: true,
          message: "Music track generated and saved to this project.",
        },
        error: null,
      });
    } catch (err) {
      await db.projectMusicTrack.update({
        where: { id: existing.id },
        data: {
          status: "failed",
        },
      });
      return NextResponse.json(
        {
          data: null,
          error: err instanceof Error ? err.message : "Music generation failed.",
        },
        { status: 502 }
      );
    }
  }

  const updated = await db.projectMusicTrack.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      generationPrompt: prompt,
      durationSeconds: totalDuration,
      status: "provider_ready",
    },
    update: {
      generationPrompt: prompt,
      durationSeconds: totalDuration,
      status: "provider_ready",
    },
  });

  return NextResponse.json({
    data: {
      track: updated,
      provider: "suno",
      providerConnected: true,
      message:
        "Suno key detected, but Suno finished-track rendering is not wired yet.",
    },
    error: null,
  });
}
