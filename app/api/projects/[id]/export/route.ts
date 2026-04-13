/**
 * POST /api/projects/[id]/export
 *
 * Triggers the full assembly and export pipeline:
 *  1. Compliance gate — rejects if any check is "fail"
 *  2. Creates an Export DB record (status = ASSEMBLING)
 *  3. Assembles each scene with transitions + color grade
 *  4. Runs final assembly (title cards + AI disclosure + platform encode)
 *  5. Generates the asset provenance PDF
 *  6. Updates the Export record with result keys and marks COMPLETE
 *
 * This is a long-running synchronous request (can take several minutes).
 * For production, move the assembly steps into a BullMQ worker.
 *
 * GET /api/projects/[id]/export — list all exports for this project
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runComplianceChecks } from "@/lib/compliance/pre-export-checker";
import { assembleScene, type SceneShotInput } from "@/lib/assembler/scene-assembler";
import { assembleFinal } from "@/lib/assembler/final-assembler";
import { generateProvenanceReport } from "@/lib/provenance/report-generator";
import type { Platform } from "@/lib/assembler/final-assembler";

const ExportRequestSchema = z.object({
  platform: z.enum(["YOUTUBE_SHORTS", "INSTAGRAM_REELS", "TIKTOK", "YOUTUBE_STANDARD"]),
  transition: z.enum(["cut", "dissolve", "fade"]).default("cut"),
  applyColorGrade: z.boolean().default(true),
});

// ─── GET — list exports ───────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  }

  try {
    const exports = await db.export.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: exports, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: "Failed to fetch exports" }, { status: 500 });
  }
}

// ─── POST — trigger export ────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { platform, transition, applyColorGrade } = parsed.data;

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { sceneNumber: "asc" },
        include: {
          shots: { orderBy: { shotNumber: "asc" } },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });
  }

  // Calculate total content duration
  const totalDurationSec = project.scenes
    .flatMap((s) => s.shots)
    .reduce((sum, sh) => sum + sh.duration, 0);

  // ── Compliance gate ──
  const report = await runComplianceChecks(params.id, platform as Platform, totalDurationSec);
  if (!report.exportAllowed) {
    return NextResponse.json(
      {
        data: { complianceReport: report },
        error: "Export blocked: compliance checks failed",
      },
      { status: 422 }
    );
  }

  // ── Create Export record ──
  const exportRecord = await db.export.create({
    data: {
      projectId: params.id,
      platform: platform as any,
      status: "ASSEMBLING",
      complianceSnapshot: report as any,
    },
  });

  try {
    // ── Assemble scenes ──
    const sceneVideoKeys: string[] = [];
    for (const scene of project.scenes) {
      const shots: SceneShotInput[] = scene.shots.map((sh) => ({
        shotId: sh.id,
        shotNumber: sh.shotNumber,
        lipSyncedVideoPath: sh.lipSyncedVideoPath,
        generatedVideoPath: sh.generatedVideoPath,
        mixedAudioPath: sh.mixedAudioPath,
        duration: sh.duration,
      }));

      const result = await assembleScene({
        projectId: params.id,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        shots,
        transition,
        applyColorGrade,
      });
      sceneVideoKeys.push(result.sceneVideoR2Key);
    }

    // ── Final assembly ──
    const finalResult = await assembleFinal({
      projectId: params.id,
      exportId: exportRecord.id,
      projectName: project.name,
      platform: platform as Platform,
      sceneVideoR2Keys: sceneVideoKeys,
      totalDurationSec,
    });

    const now = new Date();

    // ── Provenance PDF ──
    const pdfR2Key = await generateProvenanceReport({
      projectId: params.id,
      exportId: exportRecord.id,
      platform: platform as Platform,
      aiDisclosureApplied: finalResult.aiDisclosureApplied,
      disclosureTimestamp: now,
    });

    // ── Update export record ──
    const updated = await db.export.update({
      where: { id: exportRecord.id },
      data: {
        status: "COMPLETE",
        videoR2Key: finalResult.videoR2Key,
        pdfR2Key,
        durationSec: finalResult.durationSec,
        fileSizeBytes: finalResult.fileSizeBytes,
        aiDisclosureApplied: true,
        disclosureTimestamp: now,
      },
    });

    return NextResponse.json({ data: updated, error: null }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[export] Export ${exportRecord.id} failed:`, msg);

    await db.export.update({
      where: { id: exportRecord.id },
      data: { status: "FAILED", error: msg },
    });

    return NextResponse.json(
      { data: { exportId: exportRecord.id }, error: `Export failed: ${msg}` },
      { status: 500 }
    );
  }
}
