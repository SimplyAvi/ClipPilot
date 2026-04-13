import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MusicSelector from "./_components/music-selector";

export default async function MusicPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { sceneNumber: "asc" },
        include: {
          musicCue: { include: { asset: true } },
        },
      },
    },
  });

  if (!project) notFound();

  // Shape scenes for the client component
  const scenes = project.scenes.map((s) => ({
    id: s.id,
    sceneNumber: s.sceneNumber,
    title: s.title,
    musicCue: s.musicCue
      ? {
          id: s.musicCue.id,
          assetId: s.musicCue.assetId,
          startPointSec: s.musicCue.startPointSec,
          fadeInSec: s.musicCue.fadeInSec,
          fadeOutSec: s.musicCue.fadeOutSec,
          volumeDb: s.musicCue.volumeDb,
          asset: {
            id: s.musicCue.asset.id,
            name: s.musicCue.asset.name,
            sourceName: s.musicCue.asset.sourceName,
            sourceUrl: s.musicCue.asset.sourceUrl,
            licenseType: s.musicCue.asset.licenseType,
            commercialUse: s.musicCue.asset.commercialUse,
            contentIdChecked: s.musicCue.asset.contentIdChecked,
            contentIdClear: s.musicCue.asset.contentIdClear,
            attributionRequired: s.musicCue.asset.attributionRequired,
            attributionText: s.musicCue.asset.attributionText,
          },
        }
      : null,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Music</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Assign a cleared music track to each scene. Tracks are pulled from your asset library.
        Only commercially-licensed tracks with no Content ID risk are shown.
      </p>

      <MusicSelector projectId={project.id} scenes={scenes} />
    </div>
  );
}
