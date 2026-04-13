/**
 * /api/thumbnails/[projectId]
 *
 * GET  — list all thumbnails for a project
 * PATCH — select a thumbnail or update its text options
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const PatchBodySchema = z.object({
  thumbnailId: z.string().min(1),
  isSelected: z.boolean().optional(),
  titleText: z.string().optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
  textColor: z.enum(["white", "yellow", "black", "red"]).optional(),
  textPosition: z.enum(["bottom", "center", "top"]).optional(),
  textStyle: z.enum(["plain", "bold", "shadow", "outline"]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const thumbnails = await db.projectThumbnail.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: thumbnails });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  let body: z.infer<typeof PatchBodySchema>;
  try {
    body = PatchBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { thumbnailId, isSelected, ...textFields } = body;

  // If selecting this thumbnail, deselect all others first
  if (isSelected === true) {
    await db.projectThumbnail.updateMany({
      where: { projectId: params.projectId },
      data: { isSelected: false },
    });
  }

  const updated = await db.projectThumbnail.update({
    where: { id: thumbnailId },
    data: {
      ...(isSelected !== undefined ? { isSelected } : {}),
      ...textFields,
    },
  });

  return NextResponse.json({ data: updated });
}
