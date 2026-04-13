/**
 * GET /api/captions/[projectId]/download?format=srt|vtt|tiktok
 *
 * Returns a downloadable caption file based on the stored transcription segments.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSRT, generateVTT, generateTikTokCaptions } from "@/lib/captions/generator";
import type { TranscriptionData } from "@/lib/captions/generator";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  const format = request.nextUrl.searchParams.get("format") ?? "srt";

  const transcription = await db.transcription.findUnique({
    where: { projectId },
    include: { segments: { orderBy: { index: "asc" } } },
  });

  if (!transcription || transcription.segments.length === 0) {
    return NextResponse.json(
      { error: "No captions found — generate captions first" },
      { status: 404 }
    );
  }

  const data: TranscriptionData = {
    language: transcription.language ?? undefined,
    duration: transcription.durationSec ?? undefined,
    segments: transcription.segments.map((s, i) => ({
      id: i,
      start: s.startSec,
      end: s.endSec,
      text: s.text,
    })),
  };

  if (format === "vtt") {
    const vtt = generateVTT(data);
    return new NextResponse(vtt, {
      headers: {
        "Content-Type": "text/vtt",
        "Content-Disposition": `attachment; filename="captions-${projectId}.vtt"`,
      },
    });
  }

  if (format === "tiktok") {
    const json = generateTikTokCaptions(data);
    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="captions-${projectId}-tiktok.json"`,
      },
    });
  }

  // Default: SRT
  const srt = generateSRT(data);
  return new NextResponse(srt, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="captions-${projectId}.srt"`,
    },
  });
}
