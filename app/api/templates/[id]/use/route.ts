/**
 * POST /api/templates/[id]/use
 *
 * Records a template usage: increments usageCount and returns the full
 * template so the client can pre-populate the new-project form.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) {
    return NextResponse.json({ data: null, error: "Template not found" }, { status: 404 });
  }

  const updated = await db.template.update({
    where: { id: params.id },
    data: { usageCount: { increment: 1 } },
  });

  return NextResponse.json({ data: updated, error: null });
}
