/**
 * GET /api/projects/[id]/export/[exportId]
 *
 * Returns the export record with short-lived signed download URLs
 * for the video and provenance PDF (if available).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; exportId: string } }
) {
  const exportRecord = await db.export.findUnique({
    where: { id: params.exportId },
  });

  if (!exportRecord || exportRecord.projectId !== params.id) {
    return NextResponse.json({ data: null, error: "Export not found" }, { status: 404 });
  }

  // Generate signed download URLs (2-hour expiry)
  let videoDownloadUrl: string | null = null;
  let pdfDownloadUrl: string | null = null;

  try {
    if (exportRecord.videoR2Key) {
      videoDownloadUrl = await getSignedViewUrl(exportRecord.videoR2Key, 7200);
    }
  } catch { /* non-fatal */ }

  try {
    if (exportRecord.pdfR2Key) {
      pdfDownloadUrl = await getSignedViewUrl(exportRecord.pdfR2Key, 7200);
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({
    data: {
      ...exportRecord,
      videoDownloadUrl,
      pdfDownloadUrl,
    },
    error: null,
  });
}
