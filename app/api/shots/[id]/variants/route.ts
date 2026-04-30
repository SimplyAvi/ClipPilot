import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  approvedIndex: z.number().int().min(0).max(2),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const shot = await db.shot.findUnique({ where: { id: params.id } });
  if (!shot) return NextResponse.json({ data: null, error: "Shot not found" }, { status: 404 });

  const paths = parseVariantPaths(shot.variantPaths, shot.generatedVideoPath);
  const approvedPath = paths[parsed.data.approvedIndex];
  if (!approvedPath) {
    return NextResponse.json({ data: null, error: "Variant not found" }, { status: 404 });
  }

  const updated = await db.shot.update({
    where: { id: shot.id },
    data: {
      approvedVariantIndex: parsed.data.approvedIndex,
      generatedVideoPath: approvedPath,
      storagePath: approvedPath,
      status: "COMPLETE",
    },
  });

  return NextResponse.json({ data: updated, error: null });
}

function parseVariantPaths(raw: string | null, fallback: string | null): string[] {
  if (!raw) return fallback ? [fallback] : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return fallback ? [fallback] : [];
  }
}
