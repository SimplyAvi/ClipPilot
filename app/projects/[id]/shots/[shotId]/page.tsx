import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Film, Mic2, Music2 } from "lucide-react";
import { getSignedViewUrl } from "@/lib/storage";
import ADRPanel from "./_components/adr-panel";
import AudioActions from "./_components/audio-actions";

// ─── Status helpers ───────────────────────────────────────────────────────────

const SHOT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  GENERATING: { label: "Generating", variant: "default" },
  COMPLETE: { label: "Complete", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
  NEEDS_REVIEW: { label: "Needs Review", variant: "destructive" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShotReviewPage({
  params,
}: {
  params: { id: string; shotId: string };
}) {
  const shot = await db.shot.findUnique({
    where: { id: params.shotId },
    include: {
      scene: { select: { id: true, projectId: true, sceneNumber: true, title: true } },
      dialogueLines: {
        include: {
          character: {
            select: { id: true, name: true, elevenLabsVoiceId: true },
          },
        },
        orderBy: { lineIndex: "asc" },
      },
    },
  });

  if (!shot || shot.scene.projectId !== params.id) notFound();

  // Generate signed URLs for playback
  let videoUrl: string | null = null;
  let lipSyncedVideoUrl: string | null = null;
  let mixedAudioUrl: string | null = null;

  try {
    if (shot.generatedVideoPath) {
      videoUrl = await getSignedViewUrl(shot.generatedVideoPath, 3600);
    }
  } catch { /* non-fatal */ }

  try {
    if (shot.lipSyncedVideoPath) {
      lipSyncedVideoUrl = await getSignedViewUrl(shot.lipSyncedVideoPath, 3600);
    }
  } catch { /* non-fatal */ }

  try {
    if (shot.mixedAudioPath) {
      mixedAudioUrl = await getSignedViewUrl(shot.mixedAudioPath, 3600);
    }
  } catch { /* non-fatal */ }

  const status = SHOT_STATUS_LABELS[shot.status] ?? SHOT_STATUS_LABELS.DRAFT;

  // Shape dialogue lines for client components
  const dialogueLines = shot.dialogueLines.map((dl) => ({
    id: dl.id,
    lineIndex: dl.lineIndex,
    text: dl.text,
    deliveryDirection: dl.deliveryDirection,
    status: dl.status,
    audioPath: dl.audioPath,
    startTimeSec: dl.startTimeSec,
    durationSec: dl.durationSec,
    character: dl.character
      ? { id: dl.character.id, name: dl.character.name, elevenLabsVoiceId: dl.character.elevenLabsVoiceId }
      : null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              Scene {shot.scene.sceneNumber} · Shot {shot.shotNumber}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{shot.scene.title}</p>
        </div>
      </div>

      {/* Likeness flag warning */}
      {shot.status === "NEEDS_REVIEW" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Likeness flag:</strong>{" "}
          {shot.flaggedReason ?? `Possible match: ${shot.likenessMatchedName ?? "unknown"} (score ${((shot.likenessScore ?? 0) * 100).toFixed(0)}%)`}
        </div>
      )}

      {/* Video preview */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Video</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {videoUrl ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Generated (raw)</p>
              <video src={videoUrl} controls className="w-full rounded-md border" />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              No video generated yet
            </div>
          )}
          {lipSyncedVideoUrl ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Lip-synced</p>
              <video src={lipSyncedVideoUrl} controls className="w-full rounded-md border" />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
              No lip-synced video
            </div>
          )}
        </div>
      </section>

      {/* Audio actions (mix + lip sync) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Music2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Audio Pipeline</h2>
        </div>
        <AudioActions
          shotId={shot.id}
          sceneId={shot.sceneId}
          hasMixedAudio={!!shot.mixedAudioPath}
          mixedAudioUrl={mixedAudioUrl}
          lipSyncStatus={shot.lipSyncStatus}
          hasVideo={!!shot.generatedVideoPath}
        />
      </section>

      {/* Dialogue / ADR */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Dialogue Lines</h2>
          <span className="text-xs text-muted-foreground">({dialogueLines.length})</span>
        </div>
        <ADRPanel shotId={shot.id} initialLines={dialogueLines} />
      </section>

      {/* Prompt */}
      {shot.prompt && (
        <section>
          <h2 className="mb-2 font-semibold text-sm text-muted-foreground">Generation Prompt</h2>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs leading-relaxed">
            {shot.prompt}
          </pre>
        </section>
      )}
    </div>
  );
}
