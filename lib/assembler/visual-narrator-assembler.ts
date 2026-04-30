import os from "os";
import path from "path";
import fs from "fs/promises";
import { db } from "@/lib/db";
import { downloadFromR2, storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { syncVisualsToNarrator } from "@/lib/visual-narrator/timing-sync";

export async function assembleVisualNarratorVideo(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { projectMusicTrack: true, theme: true },
  });
  if (!project) throw new Error("Project not found");

  const timing = await syncVisualsToNarrator(projectId);
  if (timing.segments.length === 0) throw new Error("No complete visual narrator segments found");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cp-visual-narrator-"));
  try {
    const manifest = {
      projectId,
      projectName: project.name,
      totalDuration: timing.totalDuration,
      theme: project.theme?.name ?? null,
      segments: timing.segments,
      musicTrack: project.projectMusicTrack?.audioPath ?? null,
      note: "Visual narrator assembly manifest. FFmpeg final video assembly can consume this timing map.",
    };
    const projectSlug = project.projectSlug ?? slugify(project.name);
    const outputPath = `${projectSlug}/07_exports/${projectSlug}_visual_narrator_v1_manifest.json`;
    const stored = await storage.save(outputPath, Buffer.from(JSON.stringify(manifest, null, 2)), "application/json", {
      projectId,
      type: "visual-narrator-assembly-manifest",
    });

    // Touch all referenced storage objects now so missing files fail early.
    await Promise.all(timing.segments.flatMap((segment) => [downloadFromR2(segment.videoPath), downloadFromR2(segment.audioPath)]));
    if (project.projectMusicTrack?.audioPath) await downloadFromR2(project.projectMusicTrack.audioPath);

    return stored.path;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
