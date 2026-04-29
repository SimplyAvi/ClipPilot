/**
 * /api/projects
 * GET  — list all projects with rich dashboard data
 * POST — create a new project
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { scenes: true, assets: true, jobs: true, posts: true },
        },
        scripts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true },
        },
        exports: {
          where: { status: "COMPLETE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, platform: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({ data: projects, error: null });
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  platform: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const projectSlug = await uniqueProjectSlug(parsed.data.name);
    const project = await db.project.create({
      data: {
        name: parsed.data.name,
        platform: parsed.data.platform ?? null,
        projectSlug,
      },
    });

    await storage.initProjectFolders(projectSlug, parsed.data.name);
    await storage.save(
      `${projectSlug}/_manifest.json`,
      Buffer.from(
        JSON.stringify(
          {
            projectId: project.id,
            projectSlug,
            projectName: parsed.data.name,
            createdAt: new Date().toISOString(),
            storageVersion: "1.0",
            backend: storage.backend(),
          },
          null,
          2
        )
      ),
      "application/json"
    );

    const updated = await db.project.update({
      where: { id: project.id },
      data: { storageFolderInitialized: true },
    });

    return NextResponse.json({ data: updated, error: null }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json(
      { data: null, error: "Failed to create project" },
      { status: 500 }
    );
  }
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
