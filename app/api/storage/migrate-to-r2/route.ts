import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLocalStoragePath, getR2Config } from "@/lib/storage";
import { LocalStorageAdapter } from "@/lib/storage/local-adapter";
import { R2StorageAdapter } from "@/lib/storage/r2-adapter";
import { mimeFromPath } from "@/lib/storage/file-tree";

const BodySchema = z.object({
  projectId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const r2Config = await getR2Config();
  if (!r2Config) {
    return NextResponse.json({ data: null, error: "Cloudflare R2 is not configured." }, { status: 400 });
  }

  const projects = await db.project.findMany({
    where: parsed.data.projectId ? { id: parsed.data.projectId, projectSlug: { not: null } } : { projectSlug: { not: null } },
    select: { id: true, name: true, projectSlug: true },
  });
  if (projects.length === 0) {
    return NextResponse.json({ data: null, error: "No projects with storage folders were found." }, { status: 404 });
  }

  const local = new LocalStorageAdapter(await getLocalStoragePath());
  const r2 = new R2StorageAdapter(r2Config);
  let copied = 0;
  let skipped = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (const project of projects) {
    const slug = project.projectSlug!;
    const files = await local.list(slug);
    for (const filePath of files) {
      try {
        if (await r2.exists(filePath)) {
          skipped += 1;
          continue;
        }
        const data = await local.read(filePath);
        await r2.save(filePath, data, mimeFromPath(filePath), {
          migratedFrom: "local",
          projectId: project.id,
        });
        copied += 1;
      } catch (err) {
        errors.push({ path: filePath, error: err instanceof Error ? err.message : "Unknown migration error" });
      }
    }
  }

  return NextResponse.json({
    data: {
      projects: projects.length,
      copied,
      skipped,
      errors,
    },
    error: errors.length ? "Some files could not be migrated." : null,
  }, { status: errors.length ? 207 : 200 });
}
