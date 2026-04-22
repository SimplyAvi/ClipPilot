/**
 * lib/projects/version-manager.ts
 *
 * Non-destructive project version snapshots.
 * Every snapshot stores the full script text + project config JSON
 * so any version can be restored without losing history.
 */

import { db } from "@/lib/db";
import type { ProjectVersion } from "@prisma/client";

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveVersion(
  projectId: string,
  label: string,
  createdBy = "user"
): Promise<ProjectVersion> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const latestScript = project.scripts[0];
  const scriptSnapshot = latestScript?.content ?? "";
  const configSnapshot = JSON.stringify({
    name: project.name,
    platform: project.platform ?? null,
    status: project.status,
  });

  // Increment version number
  const lastVersion = await db.projectVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  return db.projectVersion.create({
    data: {
      projectId,
      versionNumber,
      label,
      scriptSnapshot,
      configSnapshot,
      createdBy,
    },
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  return db.projectVersion.findMany({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
  });
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restoreVersion(versionId: string): Promise<void> {
  const version = await db.projectVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Version ${versionId} not found`);

  // 1. Safety snapshot of current state before overwriting
  await saveVersion(
    version.projectId,
    `Before restore to v${version.versionNumber}`,
    "system"
  );

  // 2. Restore script text into the most recent Script record
  const latestScript = await db.script.findFirst({
    where: { projectId: version.projectId },
    orderBy: { createdAt: "desc" },
  });

  if (latestScript) {
    await db.script.update({
      where: { id: latestScript.id },
      data: { content: version.scriptSnapshot },
    });
  } else {
    await db.script.create({
      data: { projectId: version.projectId, content: version.scriptSnapshot },
    });
  }

  // 3. Restore project config (name only — don't change status or platform)
  const config = JSON.parse(version.configSnapshot) as {
    name: string;
    platform: string | null;
  };

  await db.project.update({
    where: { id: version.projectId },
    data: { name: config.name },
  });
}

// ─── Diff summary ─────────────────────────────────────────────────────────────

/**
 * Returns a one-line human-readable summary comparing two adjacent versions.
 * Used in the version history UI timeline.
 */
export function diffSummary(
  older: ProjectVersion,
  newer: ProjectVersion
): string {
  const oldLen = older.scriptSnapshot.length;
  const newLen = newer.scriptSnapshot.length;
  const delta = newLen - oldLen;
  if (delta === 0) return "Config change only";
  if (delta > 0) return `+${delta} chars added`;
  return `${delta} chars removed`;
}
