import fs from "fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocalStoragePath, isR2Configured, storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

const SaveStorageSchema = z.object({
  localRootPath: z.string().min(1),
});

export async function GET() {
  const setting = await db.storageSetting.findFirst({ orderBy: { updatedAt: "desc" } }).catch(() => null);
  const projectsNeedingFolders = await db.project.count({
    where: { storageFolderInitialized: false },
  }).catch(() => 0);
  const projects = await db.project.findMany({
    where: { projectSlug: { not: null } },
    select: { id: true, name: true, projectSlug: true },
    orderBy: { updatedAt: "desc" },
  }).catch(() => []);
  const usage = await Promise.all(
    projects.map(async (project) => {
      const slug = project.projectSlug!;
      const files = await storage.list(slug).catch(() => []);
      const sizeBytes = await storage.getProjectSize(slug).catch(() => 0);
      return { projectId: project.id, projectName: project.name, projectSlug: slug, files: files.length, sizeBytes, location: storage.backend() };
    })
  );

  return NextResponse.json({
    data: {
      localRootPath: setting?.localRootPath ?? (await getLocalStoragePath()),
      useLocalStorage: setting?.useLocalStorage ?? true,
      backend: storage.backend(),
      r2Configured: isR2Configured(),
      r2BucketName: process.env.R2_BUCKET_NAME ?? null,
      r2AccountSuffix: (process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "").slice(-4) || null,
      projectsNeedingFolders,
      usage,
    },
    error: null,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveStorageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Ensure the directory exists on disk
  try {
    fs.mkdirSync(parsed.data.localRootPath, { recursive: true });
  } catch {
    return NextResponse.json(
      { data: null, error: "Could not create storage folder — check that the path is valid and you have write permissions." },
      { status: 400 }
    );
  }

  const current = await db.storageSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  const pathChanged = current?.localRootPath !== parsed.data.localRootPath;
  const setting = current
    ? await db.storageSetting.update({
        where: { id: current.id },
        data: { localRootPath: parsed.data.localRootPath, useLocalStorage: true },
      })
    : await db.storageSetting.create({
        data: { localRootPath: parsed.data.localRootPath, useLocalStorage: true },
      });

  const projectsToInitialize = await db.project.findMany({
    where: pathChanged ? {} : { storageFolderInitialized: false },
    select: { id: true, name: true, projectSlug: true, createdAt: true },
  });

  let initialized = 0;
  for (const project of projectsToInitialize) {
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
    initialized += 1;
  }

  const projectsNeedingFolders = await db.project.count({
    where: { storageFolderInitialized: false },
  });

  return NextResponse.json({ data: { setting, projectsNeedingFolders, initialized, pathChanged }, error: null });
}
