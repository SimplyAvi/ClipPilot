import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
});

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        _count: {
          select: { scenes: true, assets: true, jobs: true },
        },
      },
    });

    return NextResponse.json({ data: projects, error: null });
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json({ data: null, error: "Failed to fetch projects" }, { status: 500 });
  }
}

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
      data: { name: parsed.data.name },
    });

    return NextResponse.json({ data: project, error: null }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json({ data: null, error: "Failed to create project" }, { status: 500 });
  }
}
