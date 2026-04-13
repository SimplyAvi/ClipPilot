import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import ThumbnailEditor from "./_components/thumbnail-editor";
import { getSignedViewUrl } from "@/lib/storage";

export const metadata = {
  title: "Thumbnails — ClipPilot",
};

export default async function ThumbnailsPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      thumbnails: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  // Generate signed URLs for all thumbnail variants (YouTube preview only — lighter payload)
  const signedUrls = await Promise.all(
    project.thumbnails.map(async (thumb) => {
      let youtubeUrl: string | null = null;
      let tiktokUrl: string | null = null;
      let squareUrl: string | null = null;

      try {
        if (thumb.youtubeR2Key) youtubeUrl = await getSignedViewUrl(thumb.youtubeR2Key, 7200);
        if (thumb.tiktokR2Key) tiktokUrl = await getSignedViewUrl(thumb.tiktokR2Key, 7200);
        if (thumb.squareR2Key) squareUrl = await getSignedViewUrl(thumb.squareR2Key, 7200);
      } catch {
        // R2 not configured in dev
      }

      return { id: thumb.id, youtubeUrl, tiktokUrl, squareUrl };
    })
  );

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Thumbnails</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.name} — generate platform-ready thumbnails
          </p>
        </div>
      </div>

      <ThumbnailEditor
        projectId={params.id}
        projectName={project.name}
        initialThumbnails={project.thumbnails.map((t) => ({
          id: t.id,
          variant: t.variant,
          isSelected: t.isSelected,
          youtubeR2Key: t.youtubeR2Key,
          tiktokR2Key: t.tiktokR2Key,
          squareR2Key: t.squareR2Key,
          titleText: t.titleText,
          fontSize: t.fontSize,
          textColor: t.textColor,
          textPosition: t.textPosition,
          textStyle: t.textStyle,
          prompt: t.prompt,
        }))}
        initialSignedUrls={signedUrls}
      />
    </div>
  );
}
