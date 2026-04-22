/**
 * POST /api/projects/[id]/archive
 *
 * Toggles archive state.
 * Body: { archived: boolean }
 * - archived: true  → sets status=ARCHIVED, archivedAt=now
 * - archived: false → restores to DRAFT (or COMPLETE if completedAt is set)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({ archived: z.boolean() });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let newStatus: "ARCHIVED" | "DRAFT" | "COMPLETE";
  let archivedAt: Date | null = null;

  if (body.archived) {
    newStatus = "ARCHIVED";
    archivedAt = new Date();
  } else {
    // Restore to COMPLETE if it was completed before archiving, else DRAFT
    newStatus = project.completedAt ? "COMPLETE" : "DRAFT";
  }

  const updated = await db.project.update({
    where: { id: params.id },
    data: { status: newStatus, archivedAt },
  });

  return NextResponse.json({ data: updated });
}
