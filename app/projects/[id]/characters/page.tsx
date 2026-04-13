import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mic, UserCircle } from "lucide-react";
import type { ScriptAnalysis } from "@/lib/prompts/script-analysis";
import ConfigureCharacterButton from "./_components/configure-character-button";

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getPageData(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      characters: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) return null;

  // Extract unique character names from parsed script analysis
  const scriptCharacters: { name: string; scenes: number[] }[] = [];
  if (project.scripts[0]?.parsedData) {
    const analysis = project.scripts[0].parsedData as unknown as ScriptAnalysis;
    const characterMap = new Map<string, number[]>();
    for (const scene of analysis.scenes) {
      for (const name of scene.charactersPresent) {
        const existing = characterMap.get(name) ?? [];
        existing.push(scene.sceneNumber);
        characterMap.set(name, existing);
      }
    }
    characterMap.forEach((scenes, name) => {
      scriptCharacters.push({ name, scenes });
    });
  }

  return { project, scriptCharacters };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CharactersPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getPageData(params.id);
  if (!data) notFound();

  const { project, scriptCharacters } = data;

  // Map configured DB characters by lower-cased name for fast lookup
  const configuredMap = new Map(
    project.characters.map((c) => [c.name.toLowerCase(), c])
  );

  // Characters in DB that were NOT detected in the script
  const extraCharacters = project.characters.filter(
    (c) => !scriptCharacters.some((sc) => sc.name.toLowerCase() === c.name.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Characters</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {scriptCharacters.length === 0 && project.characters.length === 0 && (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No characters detected. Run script analysis first.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/projects/new">Analyze a Script</Link>
          </Button>
        </div>
      )}

      {/* ── Script characters ── */}
      {scriptCharacters.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Detected in Script
          </h2>
          <div className="flex flex-col gap-3">
            {scriptCharacters.map(({ name, scenes }) => {
              const configured = configuredMap.get(name.toLowerCase());
              return (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        Scene{scenes.length !== 1 ? "s" : ""} {scenes.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {configured ? (
                      <>
                        {configured.elevenLabsVoiceId && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Mic className="h-3.5 w-3.5" />
                            Voice set
                          </span>
                        )}
                        <Badge
                          variant={configured.confirmedFictional ? "default" : "secondary"}
                        >
                          {configured.confirmedFictional ? "Configured" : "Needs review"}
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/projects/${params.id}/characters/${configured.id}`}>
                            Edit
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <ConfigureCharacterButton
                        projectId={params.id}
                        characterName={name}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Extra characters (added manually, not in script) ── */}
      {extraCharacters.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Additional Characters
          </h2>
          <div className="flex flex-col gap-3">
            {extraCharacters.map((character) => (
              <div
                key={character.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{character.name}</p>
                    {character.elevenLabsVoiceId && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Mic className="h-3.5 w-3.5" />
                        Voice set
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/projects/${params.id}/characters/${character.id}`}>
                    Edit
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
