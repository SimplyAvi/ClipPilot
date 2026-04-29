import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const CastSchema = z.object({
  projectId: z.string().min(1),
  roleInProject: z.string().max(120).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const project = await db.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) {
      return NextResponse.json(
        { data: null, error: "Could not add character to this project. The project may have been deleted." },
        { status: 404 }
      );
    }

    const cast = await db.projectCharacter.upsert({
      where: {
        characterId_projectId: {
          characterId: params.id,
          projectId: parsed.data.projectId,
        },
      },
      update: { roleInProject: parsed.data.roleInProject ?? null },
      create: {
        characterId: params.id,
        projectId: parsed.data.projectId,
        roleInProject: parsed.data.roleInProject ?? null,
      },
      include: { character: true, project: true },
    });
    return NextResponse.json({ data: cast, error: null });
  } catch (err) {
    console.error("[POST /api/characters/[id]/cast]", err);
    return NextResponse.json(
      { data: null, error: "Could not add character to this project. The project may have been deleted." },
      { status: 500 }
    );
  }
}
