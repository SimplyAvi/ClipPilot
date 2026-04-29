/**
 * POST /api/projects/[id]/duplicate
 *
 * Creates a full copy of the project: script, characters, music assignments.
 * Status is reset to DRAFT; no generated assets are copied.
 * Returns the new project.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const source = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      projectCharacters: true,
      scenes: {
        include: { musicCue: true },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Create the duplicate project
  const projectSlug = await uniqueProjectSlug(`${source.name} Copy`);
  const duplicate = await db.project.create({
    data: {
      name: `${source.name} — Copy`,
      status: "DRAFT",
      platform: source.platform,
      projectSlug,
    },
  });
  await storage.initProjectFolders(projectSlug, duplicate.name);

  // Copy the latest script
  const latestScript = source.scripts[0];
  if (latestScript) {
    await db.script.create({
      data: {
        projectId: duplicate.id,
        content: latestScript.content,
        parsedData: latestScript.parsedData ?? undefined,
      },
    });
  }

  // Reuse global characters in the duplicate project.
  for (const cast of source.projectCharacters) {
    await db.projectCharacter.create({
      data: {
        projectId: duplicate.id,
        characterId: cast.characterId,
        roleInProject: cast.roleInProject,
        scenesAppearedIn: cast.scenesAppearedIn,
      },
    });
  }

  const updated = await db.project.update({
    where: { id: duplicate.id },
    data: { storageFolderInitialized: true },
  });

  return NextResponse.json({ data: updated }, { status: 201 });
}

async function uniqueProjectSlug(projectName: string): Promise<string> {
  const base = slugify(projectName) || "project";
  let candidate = base;
  let suffix = 2;
  while (await db.project.findUnique({ where: { projectSlug: candidate } })) {
    candidate = `${base}_${suffix++}`.slice(0, 48);
  }
  return candidate;
}
