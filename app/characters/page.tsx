import Link from "next/link";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { Film, Plus, Search, UserRound } from "lucide-react";
import { GenerateFromThemeModal } from "./_components/generate-from-theme-modal";

type SearchParams = { q?: string; archived?: string; sort?: string };

export const dynamic = "force-dynamic";

export default async function CharacterLibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const q = searchParams.q?.trim();
  const archived = searchParams.archived === "true";
  const sort = searchParams.sort ?? "recent";

  const characters = await db.character.findMany({
    where: {
      isArchived: archived,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { tags: { contains: q, mode: "insensitive" } },
              { physicalDescription: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      projectCharacters: {
        include: { project: { select: { id: true, name: true, status: true } } },
        orderBy: { addedAt: "desc" },
      },
    },
    orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
  });
  const themes = await db.theme.findMany({
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      genre: true,
      tone: true,
      colorPalette: true,
      colorMood: true,
      coverFrameIndex: true,
    },
  });

  const sorted = sort === "used" ? [...characters].sort((a, b) => b.projectCharacters.length - a.projectCharacters.length) : characters;
  const portraitUrls = new Map<string, string>();
  await Promise.all(
    sorted.map(async (character) => {
      if (character.portraitPath) {
        portraitUrls.set(character.id, await getSignedViewUrl(character.portraitPath).catch(() => ""));
      }
    })
  );

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Characters</h1>
          <p className="text-sm text-muted-foreground">Reusable cast library for every movie and project.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/characters/new"><Plus className="mr-2 h-4 w-4" />New Character</Link>
          </Button>
          <GenerateFromThemeModal themes={themes} />
        </div>
      </div>

      <DraftRecoveryBanner />

      <form className="mb-6 grid gap-3 lg:grid-cols-[1fr_160px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search name, tags, description" className="pl-9" />
        </div>
        <select name="archived" defaultValue={archived ? "true" : "false"} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="false">All</option>
          <option value="true">Archived</option>
        </select>
        <select name="sort" defaultValue={sort} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="recent">Recently created</option>
          <option value="name">Name A-Z</option>
          <option value="used">Most used in projects</option>
        </select>
      </form>

      {sorted.length === 0 ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <UserRound className="mb-5 h-24 w-24 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">No characters yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Create your first character to build your cast library. Characters can be reused across any movie.
          </p>
          <Button className="mt-5" asChild><Link href="/characters/new">Create First Character</Link></Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {sorted.map((character) => {
            const projects = character.projectCharacters.map((pc) => pc.project);
            const tags = (character.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
            return (
              <Link key={character.id} href={`/characters/${character.id}`} className="group overflow-hidden rounded-lg border bg-card transition hover:-translate-y-0.5 hover:shadow-md">
                <PortraitFrame src={portraitUrls.get(character.id)} alt={character.name} size="sm" className="rounded-b-none border-0" />
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="line-clamp-1 font-semibold uppercase tracking-wide">{character.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[character.age, character.gender].filter(Boolean).join(" - ") || "Identity pending"}
                    </p>
                  </div>
                  {character.role && <Badge>{character.role}</Badge>}
                  <div className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Film className="h-3.5 w-3.5" />Used in {projects.length} movies</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {projects.slice(0, 2).map((project) => <Badge key={project.id} variant="secondary">{project.name}</Badge>)}
                    {tags.slice(0, projects.length ? 1 : 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                  </div>
                  <Button size="sm" variant="outline" className="w-full">View Profile</Button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraftRecoveryBanner() {
  return (
    <div
      id="generated-character-draft-banner"
      className="mb-6 hidden rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      suppressHydrationWarning
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `
          (() => {
            const id = localStorage.getItem('generated-character:last-draft');
            const el = document.currentScript?.parentElement;
            if (!id || !el || !localStorage.getItem('generated-character:' + id)) return;
            el.classList.remove('hidden');
            el.innerHTML = 'You have an unsaved character draft. <a class="font-semibold underline" href="/characters/review/' + id + '">Resume</a> <button class="ml-3 underline" type="button" id="discard-generated-character-draft">Discard</button>';
            document.getElementById('discard-generated-character-draft')?.addEventListener('click', () => {
              localStorage.removeItem('generated-character:' + id);
              localStorage.removeItem('generated-character:last-draft');
              el.classList.add('hidden');
            });
          })();
        `,
        }}
      />
    </div>
  );
}
