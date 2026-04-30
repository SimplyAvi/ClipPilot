import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import { NarratorClient } from "./_components/narrator-client";

export default async function NarratorPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      narratorProfile: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) notFound();

  const profile = project.narratorProfile ?? await db.narratorProfile.create({
    data: {
      projectId: project.id,
      pace: "measured",
      emotionalRange: "medium",
      tone: defaultDelivery(project.tone),
      pauseSeconds: 2,
    },
  });

  const previewUrl = profile.previewAudioPath ? await getSignedViewUrl(profile.previewAudioPath).catch(() => null) : null;

  return (
    <NarratorClient
      projectId={project.id}
      previewUrl={previewUrl}
      profile={{
        voiceId: profile.voiceId,
        voiceName: profile.voiceName,
        gender: profile.gender,
        pace: profile.pace,
        tone: profile.tone,
        emotionalRange: profile.emotionalRange,
        deliveryStyle: profile.deliveryStyle,
        pauseSeconds: profile.pauseSeconds,
        previewAudioPath: profile.previewAudioPath,
      }}
      segments={project.visualSegments.map((segment) => ({
        id: segment.id,
        stanzaText: segment.stanzaText,
        sortOrder: segment.sortOrder,
      }))}
    />
  );
}

function defaultDelivery(tone?: string | null) {
  const lower = tone?.toLowerCase() ?? "";
  if (lower.includes("tragic") || lower.includes("dark")) return "restrained, carrying weight without breaking";
  if (lower.includes("hopeful")) return "warm and gentle, finding light in the words";
  if (lower.includes("suspense")) return "measured, each word deliberate";
  if (lower.includes("epic")) return "full, resonant, commanding";
  return "quiet and introspective, letting the words breathe";
}
