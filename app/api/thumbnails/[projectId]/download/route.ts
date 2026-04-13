/**
 * GET /api/thumbnails/[projectId]/download
 *
 * Query params:
 *   thumbnailId — which thumbnail record
 *   size — youtube | tiktok | square (default: youtube)
 *
 * Returns a signed redirect to the R2 asset.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";

const SIZE_FIELD = {
  youtube: "youtubeR2Key",
  tiktok: "tiktokR2Key",
  square: "squareR2Key",
} as const;

const SIZE_FILENAME = {
  youtube: "thumbnail-youtube-1280x720.jpg",
  tiktok: "thumbnail-tiktok-1080x1920.jpg",
  square: "thumbnail-square-1080x1080.jpg",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { searchParams } = request.nextUrl;
  const thumbnailId = searchParams.get("thumbnailId");
  const size = (searchParams.get("size") ?? "youtube") as keyof typeof SIZE_FIELD;

  if (!thumbnailId) {
    return NextResponse.json({ error: "thumbnailId is required" }, { status: 400 });
  }
  if (!SIZE_FIELD[size]) {
    return NextResponse.json({ error: "size must be youtube | tiktok | square" }, { status: 400 });
  }

  const thumbnail = await db.projectThumbnail.findFirst({
    where: { id: thumbnailId, projectId: params.projectId },
  });

  if (!thumbnail) {
    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  }

  const r2Key = thumbnail[SIZE_FIELD[size]];
  if (!r2Key) {
    return NextResponse.json({ error: "This size has not been generated yet" }, { status: 404 });
  }

  try {
    const url = await getSignedViewUrl(r2Key, 3600);
    // Redirect with content-disposition filename hint via URL — client will handle download
    return NextResponse.redirect(url);
  } catch {
    // If R2 is not configured (dev), return a 404
    return NextResponse.json(
      { error: "Could not generate download URL — check R2 configuration" },
      { status: 503 }
    );
  }
}
