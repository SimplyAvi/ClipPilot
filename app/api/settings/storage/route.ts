import fs from "fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocalStoragePath, isR2Configured, storage } from "@/lib/storage";

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
  const setting = current
    ? await db.storageSetting.update({
        where: { id: current.id },
        data: { localRootPath: parsed.data.localRootPath, useLocalStorage: true },
      })
    : await db.storageSetting.create({
        data: { localRootPath: parsed.data.localRootPath, useLocalStorage: true },
      });

  const projectsNeedingFolders = await db.project.count({
    where: { storageFolderInitialized: false },
  });

  return NextResponse.json({ data: { setting, projectsNeedingFolders }, error: null });
}
