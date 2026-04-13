import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AssetType, LicenseType } from "@prisma/client";

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required").max(200),
  type: z.nativeEnum(AssetType),
  sourceName: z.string().min(1, "Source name is required").max(300),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  licenseType: z.nativeEnum(LicenseType),
  licenseUrl: z.string().url().optional().or(z.literal("")),
  // null = unknown
  commercialUse: z.boolean().nullable(),
  monetizationAllowed: z.boolean().nullable(),
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  projectId: z.string().optional(), // omit for global library assets
});

// ─── GET /api/assets ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as AssetType | null;
  const projectId = searchParams.get("projectId");

  try {
    const assets = await db.asset.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: assets, error: null });
  } catch (err) {
    console.error("[GET /api/assets]", err);
    return NextResponse.json({ data: null, error: "Failed to fetch assets" }, { status: 500 });
  }
}

// ─── POST /api/assets ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const {
    name, type, sourceName, sourceUrl, licenseType, licenseUrl,
    commercialUse, monetizationAllowed, attributionRequired, attributionText,
    notes, projectId,
  } = parsed.data;

  try {
    const asset = await db.asset.create({
      data: {
        name,
        type,
        sourceName,
        sourceUrl: sourceUrl || null,
        licenseType,
        licenseUrl: licenseUrl || null,
        commercialUse,
        monetizationAllowed,
        attributionRequired,
        attributionText: attributionRequired ? (attributionText ?? null) : null,
        notes: notes || null,
        projectId: projectId || null,
      },
    });

    return NextResponse.json({ data: asset, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/assets]", err);
    return NextResponse.json({ data: null, error: "Failed to create asset" }, { status: 500 });
  }
}
