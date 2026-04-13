import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CharacterEditorForm from "./_components/character-editor-form";
import type { CharacterData } from "./_components/character-editor-form";

export default async function CharacterEditorPage({
  params,
}: {
  params: { id: string; characterId: string };
}) {
  const character = await db.character.findUnique({
    where: { id: params.characterId },
    include: { project: { select: { name: true } } },
  });

  if (!character || character.projectId !== params.id) notFound();

  // Serialize to a plain object safe for client component props
  const characterData: CharacterData = {
    id: character.id,
    projectId: character.projectId,
    name: character.name,
    ageAppearance: character.ageAppearance,
    description: character.description,
    personalityNotes: character.personalityNotes,
    elevenLabsVoiceId: character.elevenLabsVoiceId,
    voiceName: character.voiceName,
    speakingPace: character.speakingPace,
    emotionalRange: character.emotionalRange,
    accent: character.accent,
    confirmedFictional: character.confirmedFictional,
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}/characters`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="text-sm text-muted-foreground">{character.project.name}</p>
        </div>
      </div>

      <CharacterEditorForm character={characterData} projectId={params.id} />
    </div>
  );
}
