import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

export async function POST() {
  const projects = await db.project.findMany({
    where: { storageFolderInitialized: false },
    select: { id: true, name: true, projectSlug: true, createdAt: true },
  });

  for (const project of projects) {
    const projectSlug = project.projectSlug ?? slugify(project.name);
    await storage.initProjectFolders(projectSlug, project.name);
    await storage.save(
      `${projectSlug}/_manifest.json`,
      Buffer.from(
        JSON.stringify(
          {
            projectId: project.id,
            projectSlug,
            projectName: project.name,
            createdAt: project.createdAt.toISOString(),
            storageVersion: "1.0",
            backend: storage.backend(),
          },
          null,
          2
        )
      ),
      "application/json"
    );
    await db.project.update({
      where: { id: project.id },
      data: { projectSlug, storageFolderInitialized: true },
    });
  }

  return NextResponse.json({ data: { initialized: projects.length }, error: null });
}
