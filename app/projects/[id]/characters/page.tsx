import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { ArrowLeft, Plus, UserRound } from "lucide-react";
import CastExistingCharacterButton from "./_components/cast-existing-character-button";

export default async function ProjectCharactersPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      projectCharacters: {
        include: { character: true },
        orderBy: { addedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${params.id}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Characters</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CastExistingCharacterButton projectId={project.id} />
          <Button asChild><Link href={`/characters/new?projectId=${project.id}`}><Plus className="mr-2 h-4 w-4" />Create New Character</Link></Button>
        </div>
      </div>

      {project.projectCharacters.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <UserRound className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No characters are cast in this project yet.</p>
          <div className="mt-4 flex justify-center gap-2">
            <CastExistingCharacterButton projectId={project.id} />
            <Button variant="outline" asChild><Link href={`/characters/new?projectId=${project.id}`}>Create New Character</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {project.projectCharacters.map((cast) => (
            <div key={cast.id} className="overflow-hidden rounded-lg border bg-card">
              <PortraitFrame src={cast.character.portraitPath} alt={cast.character.name} size="sm" className="rounded-b-none border-0" />
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="font-semibold">{cast.character.name}</h2>
                  <p className="text-sm text-muted-foreground">{cast.roleInProject ?? cast.character.role ?? "Cast member"}</p>
                </div>
                {cast.character.role && <Badge>{cast.character.role}</Badge>}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/characters/${cast.character.id}`}>View Full Profile</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
