/**
 * GET /api/projects/[id]/compliance?platform=YOUTUBE_SHORTS&durationSec=45
 *
 * Runs all pre-export compliance checks and returns the structured report.
 * Does NOT modify any data — read-only.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runComplianceChecks } from "@/lib/compliance/pre-export-checker";
import type { Platform } from "@/lib/assembler/final-assembler";

const VALID_PLATFORMS: Platform[] = [
  "YOUTUBE_SHORTS",
  "INSTAGRAM_REELS",
  "TIKTOK",
  "YOUTUBE_STANDARD",
];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") as Platform | null;
  const durationSec = parseFloat(searchParams.get("durationSec") ?? "0");

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { data: null, error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  }

  try {
    const report = await runComplianceChecks(params.id, platform, durationSec);
    return NextResponse.json({ data: report, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/projects/[id]/compliance]", msg);
    return NextResponse.json({ data: null, error: `Compliance check failed: ${msg}` }, { status: 500 });
  }
}
