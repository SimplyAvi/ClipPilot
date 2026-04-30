import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const UpdateSchema = z.object({
  visualConcept: z.string().min(1).optional(),
  primarySubject: z.string().min(1).optional(),
  movementStyle: z.string().min(1).optional(),
  cameraApproach: z.string().min(1).optional(),
  colorTemperature: z.string().min(1).optional(),
  emotionalQuality: z.string().nullable().optional(),
  additionalNotes: z.string().nullable().optional(),
  generationPrompt: z.string().nullable().optional(),
  generatedVideoPath: z.string().nullable().optional(),
  approvedVariantIdx: z.number().int().min(0).max(2).optional(),
  status: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const segment = await db.visualSegment.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ data: segment, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Segment not found" }, { status: 404 });
  }
}
