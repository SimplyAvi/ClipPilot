/**
 * lib/projects/status-updater.ts
 *
 * Central helper to update project status throughout the pipeline.
 * Called at each pipeline stage completion.
 */

import { db } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

type UpdateData = {
  status: ProjectStatus;
  completedAt?: Date;
  archivedAt?: Date;
};

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const data: UpdateData = { status };

  if (status === "COMPLETE") {
    data.completedAt = new Date();
  }
  if (status === "ARCHIVED") {
    data.archivedAt = new Date();
  }

  await db.project.update({ where: { id: projectId }, data });
}

/**
 * Convenience: mark project as PUBLISHED when any social post succeeds.
 * Idempotent — safe to call multiple times.
 */
export async function markProjectPublished(projectId: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return;
  if (project.status === "ARCHIVED") return; // don't override archive
  await db.project.update({
    where: { id: projectId },
    data: { status: "PUBLISHED" },
  });
}

/**
 * Syncs the project's denormalised thumbnailPath from the selected
 * ProjectThumbnail. Call after thumbnail generation / selection changes.
 */
export async function syncProjectThumbnailPath(projectId: string): Promise<void> {
  const selected = await db.projectThumbnail.findFirst({
    where: { projectId, isSelected: true },
    select: { youtubeR2Key: true },
  });
  await db.project.update({
    where: { id: projectId },
    data: { thumbnailPath: selected?.youtubeR2Key ?? null },
  });
}
