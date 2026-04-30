import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CharacterForm } from "../../_components/character-form";

export default async function EditCharacterPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { projectId?: string };
}) {
  const character = await db.character.findUnique({
    where: { id: params.id },
    include: { projectCharacters: { select: { id: true } } },
  });
  if (!character) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/characters/${character.id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit {character.name}</h1>
          <p className="text-sm text-muted-foreground">Update identity, portrait, backstory, and voice details.</p>
        </div>
      </div>
      <CharacterForm initialCharacter={character} defaultProjectId={searchParams.projectId ?? null} />
    </div>
  );
}
