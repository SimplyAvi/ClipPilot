/**
 * /api/templates/[id]
 * GET    — single template
 * PATCH  — update user template (built-in templates are read-only)
 * DELETE — delete user template (built-in templates cannot be deleted)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ data: null, error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: template, error: null });
}

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  visualStyle: z.string().optional(),
  audioStyle: z.string().optional(),
  targetPlatform: z.string().optional(),
  targetLength: z.string().optional(),
  characterConfig: z.string().nullable().optional(),
  musicConfig: z.string().nullable().optional(),
  generationConfig: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ data: null, error: "Template not found" }, { status: 404 });
  }
  if (template.isBuiltIn) {
    return NextResponse.json(
      { data: null, error: "Built-in templates cannot be modified" },
      { status: 403 }
    );
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 400 });
  }

  const updated = await db.template.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ data: null, error: "Template not found" }, { status: 404 });
  }
  if (template.isBuiltIn) {
    return NextResponse.json(
      { data: null, error: "Built-in templates cannot be deleted" },
      { status: 403 }
    );
  }

  await db.template.delete({ where: { id: params.id } });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
