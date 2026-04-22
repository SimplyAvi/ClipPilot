/**
 * /api/projects/[id]
 * GET    — return single project with full stats
 * PATCH  — update name / status / platform / thumbnailPath
 * DELETE — delete project + all R2 files
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteFromR2 } from "@/lib/storage";
import type { ProjectStatus } from "@prisma/client";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { scenes: true, assets: true, jobs: true, posts: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z
    .enum([
      "DRAFT",
      "SCRIPT_ANALYZING",
      "PLANNING",
      "GENERATING",
      "ASSEMBLING",
      "IN_PROGRESS",
      "COMPLETE",
      "PUBLISHED",
      "ARCHIVED",
    ])
    .optional(),
  platform: z.string().nullable().optional(),
  thumbnailPath: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...body };
  if (body.status === "COMPLETE") data.completedAt = new Date();
  if (body.status === "ARCHIVED") data.archivedAt = new Date();

  const project = await db.project.update({
    where: { id: params.id },
    data: data as Parameters<typeof db.project.update>[0]["data"],
  });

  return NextResponse.json({ data: project });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        include: {
          shots: true,
        },
      },
      exports: true,
      thumbnails: true,
      transcription: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Collect all R2 keys to delete
  const r2Keys: string[] = [];

  // Shot videos + thumbnails + audio
  for (const scene of project.scenes) {
    for (const shot of scene.shots) {
      if (shot.generatedVideoPath) r2Keys.push(shot.generatedVideoPath);
      if (shot.thumbnailPath) r2Keys.push(shot.thumbnailPath);
      if (shot.mixedAudioPath) r2Keys.push(shot.mixedAudioPath);
      if (shot.dialogueStemPath) r2Keys.push(shot.dialogueStemPath);
      if (shot.musicStemPath) r2Keys.push(shot.musicStemPath);
      if (shot.lipSyncedVideoPath) r2Keys.push(shot.lipSyncedVideoPath);
    }
  }

  // Exports
  for (const exp of project.exports) {
    if (exp.videoR2Key) r2Keys.push(exp.videoR2Key);
    if (exp.pdfR2Key) r2Keys.push(exp.pdfR2Key);
  }

  // Thumbnails
  for (const thumb of project.thumbnails) {
    if (thumb.youtubeR2Key) r2Keys.push(thumb.youtubeR2Key);
    if (thumb.tiktokR2Key) r2Keys.push(thumb.tiktokR2Key);
    if (thumb.squareR2Key) r2Keys.push(thumb.squareR2Key);
    if (thumb.baseFramePath) r2Keys.push(thumb.baseFramePath);
  }

  // Delete R2 files (best-effort — don't fail if some are missing)
  const deletions = r2Keys.map((key) =>
    deleteFromR2(key).catch((err) =>
      console.warn(`[DELETE /api/projects/${params.id}] R2 delete failed for ${key}:`, err)
    )
  );
  await Promise.allSettled(deletions);

  // Cascade delete from DB (Prisma onDelete: Cascade handles relations)
  await db.project.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { deleted: true } });
}
