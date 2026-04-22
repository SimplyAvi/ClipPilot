/**
 * GET /api/social/posts/[projectId]
 * Returns all social posts for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const posts = await db.socialPost.findMany({
    where: { projectId: params.projectId },
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json({ data: posts });
}
