import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PatchAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  licenseUrl: z.string().url().optional().or(z.literal("")),
  commercialUse: z.boolean().nullable().optional(),
  monetizationAllowed: z.boolean().nullable().optional(),
  attributionRequired: z.boolean().optional(),
  attributionText: z.string().max(500).optional(),
  contentIdChecked: z.boolean().optional(),
  contentIdClear: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
}).strict();

// ─── PATCH /api/assets/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  try {
    const asset = await db.asset.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ data: asset, error: null });
  } catch (err) {
    console.error("[PATCH /api/assets/[id]]", err);
    return NextResponse.json({ data: null, error: "Asset not found or update failed" }, { status: 404 });
  }
}

// ─── DELETE /api/assets/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await db.asset.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    console.error("[DELETE /api/assets/[id]]", err);
    return NextResponse.json({ data: null, error: "Asset not found" }, { status: 404 });
  }
}
