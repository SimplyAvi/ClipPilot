import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import { ProjectMusicClient } from "./_components/project-music-client";

export default async function ProjectMusicPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      theme: true,
      projectMusicTrack: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) notFound();

  const track = project.projectMusicTrack ?? await db.projectMusicTrack.create({
    data: {
      projectId: project.id,
      style: project.theme?.audioStyle ?? "ambient cinematic",
      mood: project.theme?.musicMood ?? project.tone,
      tempo: project.theme?.musicTempo ?? "Atmospheric",
      primaryInstrument: "ambient piano",
      silenceUsage: "Moderate",
      emotionalArc: "A gradual rise through the center of the piece, resolving softly at the end.",
    },
  });

  const audioUrl = track.audioPath ? await getSignedViewUrl(track.audioPath).catch(() => null) : null;

  return (
    <ProjectMusicClient
      projectId={project.id}
      audioUrl={audioUrl}
      initialTrack={{
        mood: track.mood,
        tempo: track.tempo,
        style: track.style,
        primaryInstrument: track.primaryInstrument,
        silenceUsage: track.silenceUsage,
        emotionalArc: track.emotionalArc,
        audioPath: track.audioPath,
        generationPrompt: track.generationPrompt,
        status: track.status,
      }}
      segments={project.visualSegments.map((segment) => ({
        id: segment.id,
        emotionalQuality: segment.emotionalQuality,
        sortOrder: segment.sortOrder,
      }))}
    />
  );
}
