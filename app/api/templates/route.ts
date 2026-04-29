/**
 * /api/templates
 * GET  — list all templates (built-in first, then user templates by usageCount)
 * POST — create a new user template
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const templates = await db.template.findMany({
      orderBy: [
        { isBuiltIn: "desc" },
        { usageCount: "desc" },
        { createdAt: "desc" },
      ],
    });
    return NextResponse.json({ data: templates, error: null });
  } catch (err) {
    console.error("[GET /api/templates]", err);
    return NextResponse.json(
      { data: null, error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  genre: z.string().min(1),
  tone: z.string().min(1),
  visualStyle: z.string().min(1),
  audioStyle: z.string().min(1),
  targetPlatform: z.string().min(1),
  targetLength: z.string().min(1),
  sourceProjectId: z.string().optional(),
  characterConfig: z.string().optional(),
  musicConfig: z.string().optional(),
  generationConfig: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 400 });
  }

  try {
    const template = await db.template.create({
      data: { ...body, isBuiltIn: false },
    });
    return NextResponse.json({ data: template, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/templates]", err);
    return NextResponse.json(
      { data: null, error: "Failed to create template" },
      { status: 500 }
    );
  }
}
