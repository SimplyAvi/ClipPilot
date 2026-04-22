/**
 * /api/projects
 * GET  — list all projects with rich dashboard data
 * POST — create a new project
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

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

    const project = await db.project.create({
      data: {
        name: parsed.data.name,
        platform: parsed.data.platform ?? null,
      },
    });

    return NextResponse.json({ data: project, error: null }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json(
      { data: null, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
