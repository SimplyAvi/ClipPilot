import Link from "next/link";
import type React from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { ArrowLeft, Edit3, RotateCw } from "lucide-react";
import { CharacterDetailActions } from "../_components/character-detail-actions";
import { RestorePortraitButton } from "../_components/restore-portrait-button";

export default async function CharacterDetailPage({ params }: { params: { id: string } }) {
  const character = await db.character.findUnique({
    where: { id: params.id },
    include: {
      projectCharacters: {
        include: { project: { select: { id: true, name: true, status: true, thumbnailPath: true } } },
        orderBy: { addedAt: "desc" },
      },
      portraitGenerations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!character) notFound();

  const tags = (character.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/characters"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{character.name}</h1>
            <p className="text-sm text-muted-foreground">Global character profile</p>
          </div>
        </div>
        <Button variant="outline" asChild><Link href={`/characters/${character.id}/edit`}><Edit3 className="mr-2 h-4 w-4" />Edit</Link></Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <PortraitFrame src={character.portraitPath} alt={character.name} size="full" />
          <div>
            <h2 className="text-3xl font-bold">{character.name}</h2>
            {character.role && <Badge className="mt-2">{character.role}</Badge>}
            <p className="mt-2 text-sm text-muted-foreground">
              {[character.age, character.gender, character.ethnicity].filter(Boolean).join(" - ") || "Identity details pending"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">{tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full" asChild><Link href={`/characters/${character.id}/edit`}><RotateCw className="mr-2 h-4 w-4" />Regenerate Portrait</Link></Button>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={character.portraitStyle ?? "cinematic-realistic"}>
              <option>Cinematic Realistic</option>
              <option>Stylized</option>
              <option>Illustrated</option>
              <option>Noir</option>
            </select>
          </div>
        </aside>

        <main className="space-y-8">
          <DetailSection title="Biography" editHref={`/characters/${character.id}/edit`}>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
              {character.biography || "No biography written yet. Click edit to add this character's backstory."}
            </p>
          </DetailSection>

          <DetailSection title="Personality & Motivations" editHref={`/characters/${character.id}/edit`}>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoBlock label="Personality" value={character.personality} />
              <InfoBlock label="Motivations" value={character.motivations} />
              <InfoBlock label="Fears" value={character.fears} />
              <InfoBlock label="Quirks" value={character.quirks} />
            </div>
          </DetailSection>

          <DetailSection title="Physical Details" editHref={`/characters/${character.id}/edit`}>
            <InfoBlock label="Physical description" value={character.physicalDescription} />
            <InfoBlock label="Forbidden changes" value={character.forbiddenChanges} />
          </DetailSection>

          <DetailSection title="Voice Profile" editHref={`/characters/${character.id}/edit`}>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <InfoBlock label="Voice" value={character.voiceId ? "ElevenLabs voice assigned" : "Not assigned"} />
              <InfoBlock label="Pace" value={character.voicePace} />
              <InfoBlock label="Accent" value={character.voiceAccent} />
              <InfoBlock label="Tone" value={character.voiceTone} />
              <InfoBlock label="Notes" value={character.voiceNotes} />
            </div>
            <div className="mt-4">
              <CharacterDetailActions character={{ id: character.id, name: character.name, portraitPath: character.portraitPath, voiceId: character.voiceId }} />
            </div>
          </DetailSection>

          <DetailSection title="Movies & Projects" editHref={null}>
            {character.projectCharacters.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">This character hasn&apos;t been cast in any movie yet.</p>
                <div className="mt-4"><CharacterDetailActions character={{ id: character.id, name: character.name, portraitPath: character.portraitPath, voiceId: character.voiceId }} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                {character.projectCharacters.map((cast) => (
                  <div key={cast.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <PortraitFrame src={character.portraitPath} alt={character.name} size="sm" className="w-16" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{cast.project.name}</p>
                      <p className="text-sm text-muted-foreground">Role: {cast.roleInProject ?? character.role ?? "Cast member"}</p>
                      <p className="text-sm text-muted-foreground">Scenes: {cast.scenesAppearedIn ?? "Not tracked"}</p>
                    </div>
                    <Badge variant="secondary">{cast.project.status}</Badge>
                    <Button variant="outline" size="sm" asChild><Link href={`/projects/${cast.project.id}`}>Open Project</Link></Button>
                  </div>
                ))}
                <CharacterDetailActions character={{ id: character.id, name: character.name, portraitPath: character.portraitPath, voiceId: character.voiceId }} />
              </div>
            )}
          </DetailSection>

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">Generation History</summary>
            <div className="mt-4 space-y-3">
              {character.portraitGenerations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No portrait generations yet.</p>
              ) : character.portraitGenerations.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[80px_1fr_auto]">
                  <PortraitFrame src={item.imagePath || null} alt="Portrait version" size="sm" className="w-20" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.createdAt.toLocaleString()}</p>
                    <p className="line-clamp-2 text-sm">{item.prompt}</p>
                    {item.flagged && <Badge variant="destructive">Flagged</Badge>}
                  </div>
                  {!item.flagged && item.imagePath && (
                    <RestorePortraitButton characterId={character.id} imagePath={item.imagePath} prompt={item.prompt} />
                  )}
                </div>
              ))}
            </div>
          </details>
        </main>
      </div>
    </div>
  );
}

function DetailSection({ title, editHref, children }: { title: string; editHref: string | null; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {editHref && <Button variant="ghost" size="icon" asChild><Link href={editHref}><Edit3 className="h-4 w-4" /></Link></Button>}
      </div>
      {children}
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not set"}</p>
    </div>
  );
}
