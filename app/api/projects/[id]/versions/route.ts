/**
 * /api/projects/[id]/versions
 * GET  — list all versions (newest first)
 * POST — save a new version snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveVersion, listVersions } from "@/lib/projects/version-manager";

const PostSchema = z.object({
  label: z.string().min(1).max(120),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const versions = await listVersions(params.id);
  return NextResponse.json({ data: versions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  try {
    const version = await saveVersion(params.id, body.label);
    return NextResponse.json({ data: version }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
