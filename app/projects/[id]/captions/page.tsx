import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Captions } from "lucide-react";
import CaptionEditor from "./_components/caption-editor";
import { getSignedViewUrl } from "@/lib/storage";

export const metadata = {
  title: "Captions — ClipPilot",
};

export default async function CaptionsPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      transcription: {
        include: {
          segments: { orderBy: { index: "asc" } },
        },
      },
      exports: {
        where: { status: "COMPLETE", videoR2Key: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) notFound();

  // Get a signed URL for the most recent exported video (for preview)
  let videoUrl: string | null = null;
  const latestExport = project.exports[0];
  if (latestExport?.videoR2Key) {
    try {
      videoUrl = await getSignedViewUrl(latestExport.videoR2Key, 7200);
    } catch {
      // R2 not configured — no preview available
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Captions className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Captions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.name} — generate accurate captions from the audio mix
          </p>
        </div>
      </div>

      <CaptionEditor
        projectId={params.id}
        videoUrl={videoUrl}
        initialTranscription={project.transcription as Parameters<typeof CaptionEditor>[0]["initialTranscription"]}
      />
    </div>
  );
}
