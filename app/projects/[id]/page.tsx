import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clapperboard, Users, Music, ShieldCheck, Upload, Captions, Image as ImageIcon, Share2, History } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  COMPLETE: { label: "Complete", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "destructive" },
};

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { scenes: true, assets: true, jobs: true } },
    },
  });

  if (!project) notFound();

  const status = STATUS_LABELS[project.status] ?? STATUS_LABELS.DRAFT;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {project.scripts.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/analysis`}>View Script Analysis</Link>
          </Button>
          <Button asChild>
            <Link href={`/projects/${project.id}/characters`}>
              <Users className="mr-2 h-4 w-4" />
              Configure Characters
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/music`}>
              <Music className="mr-2 h-4 w-4" />
              Music
            </Link>
          </Button>
          <Button asChild variant="default">
            <Link href={`/projects/${project.id}/generate`}>
              <Clapperboard className="mr-2 h-4 w-4" />
              Generate Video
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/compliance`}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Compliance
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/captions`}>
              <Captions className="mr-2 h-4 w-4" />
              Captions
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/thumbnails`}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Thumbnails
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/export`}>
              <Upload className="mr-2 h-4 w-4" />
              Export
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/publish`}>
              <Share2 className="mr-2 h-4 w-4" />
              Publish
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/versions`}>
              <History className="mr-2 h-4 w-4" />
              Versions
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
