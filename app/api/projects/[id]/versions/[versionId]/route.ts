/**
 * /api/projects/[id]/versions/[versionId]
 * GET  — return single version (for preview modal)
 * POST — restore this version (body: { action: "restore" })
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { restoreVersion } from "@/lib/projects/version-manager";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const version = await db.projectVersion.findFirst({
    where: { id: params.versionId, projectId: params.id },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({ data: version });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "restore") {
    return NextResponse.json(
      { error: 'body must be { action: "restore" }' },
      { status: 400 }
    );
  }

  try {
    await restoreVersion(params.versionId);
    return NextResponse.json({ data: { restored: true } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
