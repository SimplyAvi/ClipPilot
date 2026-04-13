/**
 * Asset Provenance Report Generator — Phase 7
 *
 * Generates a PDF documenting the full chain of custody for every asset
 * used in a project export. Required for legal compliance records.
 *
 * Sections:
 *  1. Cover: project name, export platform, generated timestamp
 *  2. AI Disclosure: status, timestamp
 *  3. Music Assets: name, source, license, Content ID status
 *  4. Voice Assets: provider, ElevenLabs plan, character name, license
 *  5. Visual Generation: provider, model, prompt hash, shot date
 *  6. Likeness Scan Results: per-shot pass/flagged status
 *
 * Uses pdfkit (pure JS, no system dependency).
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage";
import type { Platform } from "@/lib/assembler/final-assembler";
import { PLATFORM_SPECS } from "@/lib/assembler/final-assembler";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProvenanceReportInput {
  projectId: string;
  exportId: string;
  platform: Platform;
  aiDisclosureApplied: boolean;
  disclosureTimestamp: Date | null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateProvenanceReport(
  input: ProvenanceReportInput
): Promise<string> {
  const { projectId, exportId, platform, aiDisclosureApplied, disclosureTimestamp } = input;

  // Load all data needed for the report
  const [project, scenes, characters, musicCues] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId } }),
    db.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      include: {
        shots: {
          orderBy: { shotNumber: "asc" },
          select: {
            id: true,
            shotNumber: true,
            sceneId: true,
            prompt: true,
            generatedVideoPath: true,
            likenessChecked: true,
            likenessCheckPassed: true,
            likenessMatchedName: true,
            likenessScore: true,
            generationCostUsd: true,
            updatedAt: true,
          },
        },
        musicCue: { include: { asset: true } },
      },
    }),
    db.character.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    db.scene.findMany({
      where: { projectId },
      include: { musicCue: { include: { asset: true } } },
    }),
  ]);

  const uniqueMusicAssets = deduplicateById(
    musicCues.flatMap((s) => (s.musicCue ? [s.musicCue.asset] : []))
  );

  const allShots = scenes.flatMap((s) =>
    s.shots.map((sh) => ({ ...sh, sceneNumber: s.sceneNumber }))
  );

  // Build PDF using pdfkit
  const PDFDocument = await loadPdfKit();
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve) => {
    doc.on("end", resolve);

    // ── Cover ──
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Asset Provenance Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).font("Helvetica").text(project.name, { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#666666")
      .text(`Platform: ${PLATFORM_SPECS[platform].label}`, { align: "center" });
    doc.text(`Export ID: ${exportId}`, { align: "center" });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown(1.5);

    horizontalRule(doc);

    // ── AI Disclosure ──
    sectionHeader(doc, "AI Disclosure");
    kvRow(doc, "Status", aiDisclosureApplied ? "APPLIED ✓" : "NOT APPLIED ✗");
    kvRow(doc, "Overlay text", "AI Generated Content");
    kvRow(doc, "Overlay duration", "3 seconds at video start");
    kvRow(doc, "Applied at", disclosureTimestamp?.toISOString() ?? "Pending export");
    doc.moveDown(1);

    horizontalRule(doc);

    // ── Music Assets ──
    sectionHeader(doc, "Music Assets");
    if (uniqueMusicAssets.length === 0) {
      doc.fontSize(10).fillColor("#666666").text("No music tracks assigned to this project.");
      doc.fillColor("#000000");
    } else {
      uniqueMusicAssets.forEach((asset, i) => {
        doc.fontSize(11).font("Helvetica-Bold").text(`${i + 1}. ${asset.name}`);
        doc.font("Helvetica");
        kvRow(doc, "Source", asset.sourceName);
        kvRow(doc, "License", asset.licenseType.replace(/_/g, " "));
        kvRow(doc, "Commercial use", asset.commercialUse === true ? "Yes ✓" : asset.commercialUse === false ? "No ✗" : "Unverified ⚠");
        kvRow(doc, "Content ID check", asset.contentIdChecked ? (asset.contentIdClear ? "Clear ✓" : "Risk ✗") : "Not checked ⚠");
        if (asset.attributionRequired) {
          kvRow(doc, "Attribution", asset.attributionText ?? "Required — see license");
        }
        if (asset.licenseUrl) kvRow(doc, "License URL", asset.licenseUrl);
        doc.moveDown(0.5);
      });
    }
    doc.moveDown(0.5);
    horizontalRule(doc);

    // ── Voice Assets ──
    sectionHeader(doc, "Voice Assets (ElevenLabs)");
    if (characters.length === 0) {
      doc.fontSize(10).fillColor("#666666").text("No characters configured.");
      doc.fillColor("#000000");
    } else {
      characters.forEach((char, i) => {
        doc.fontSize(11).font("Helvetica-Bold").text(`${i + 1}. ${char.name}`);
        doc.font("Helvetica");
        kvRow(doc, "Provider", "ElevenLabs");
        kvRow(doc, "License", "ElevenLabs Creator Plan — Commercial use permitted");
        kvRow(doc, "Voice ID", char.elevenLabsVoiceId ?? "Not configured");
        kvRow(doc, "Voice name", char.voiceName ?? "—");
        kvRow(doc, "Fictional character confirmed", char.confirmedFictional ? "Yes ✓" : "No ✗");
        doc.moveDown(0.5);
      });
    }
    doc.moveDown(0.5);
    horizontalRule(doc);

    // ── Visual Generation ──
    sectionHeader(doc, "Visual Generation");
    allShots.forEach((shot) => {
      const promptHash = shot.prompt
        ? crypto.createHash("sha256").update(shot.prompt).digest("hex").substring(0, 12)
        : "n/a";
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`Scene ${shot.sceneNumber} · Shot ${shot.shotNumber}`, { continued: true })
        .font("Helvetica")
        .text(`  — ${shot.generatedVideoPath ? "Generated" : "Not generated"}`);
      kvRowSmall(doc, "Provider", "Runway ML Gen-3 / Replicate zeroscope-v2-xl");
      kvRowSmall(doc, "Prompt hash (SHA-256)", promptHash);
      kvRowSmall(doc, "Date", shot.updatedAt.toISOString().split("T")[0]);
      if (shot.generationCostUsd) {
        kvRowSmall(doc, "Cost", `$${shot.generationCostUsd.toFixed(4)}`);
      }
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);
    horizontalRule(doc);

    // ── Likeness Scan Results ──
    sectionHeader(doc, "Likeness Scan Results");
    const scannedShots = allShots.filter((s) => s.likenessChecked);
    const unscannedShots = allShots.filter((s) => !s.likenessChecked);

    if (scannedShots.length === 0) {
      doc.fontSize(10).fillColor("#666666").text("No likeness scans performed (LIKENESS_CHECK_ENABLED not set).");
      doc.fillColor("#000000");
    } else {
      scannedShots.forEach((shot) => {
        const passed = shot.likenessCheckPassed;
        const statusText = passed === true ? "Pass ✓" : passed === false ? `FLAGGED ✗ — ${shot.likenessMatchedName ?? "unknown"} (${((shot.likenessScore ?? 0) * 100).toFixed(0)}%)` : "—";
        doc
          .fontSize(10)
          .text(`Scene ${shot.sceneNumber} · Shot ${shot.shotNumber}: ${statusText}`);
      });
    }
    if (unscannedShots.length > 0) {
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor("#b45309")
        .text(`${unscannedShots.length} shot(s) not scanned — likeness check was disabled or not run.`);
      doc.fillColor("#000000");
    }

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  const r2Key = `projects/${projectId}/exports/${exportId}/provenance-report.pdf`;
  await uploadToR2(r2Key, pdfBuffer, "application/pdf");

  console.log(`[provenance] Report uploaded → ${r2Key}`);
  return r2Key;
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function sectionHeader(doc: any, title: string): void {
  doc.moveDown(0.5);
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e40af").text(title);
  doc.fillColor("#000000").fontSize(10).font("Helvetica");
  doc.moveDown(0.4);
}

function horizontalRule(doc: any): void {
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.5);
}

function kvRow(doc: any, key: string, value: string): void {
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(`${key}: `, { continued: true })
    .font("Helvetica")
    .text(value);
}

function kvRowSmall(doc: any, key: string, value: string): void {
  doc
    .fontSize(9)
    .fillColor("#374151")
    .font("Helvetica-Bold")
    .text(`  ${key}: `, { continued: true })
    .font("Helvetica")
    .text(value);
  doc.fillColor("#000000");
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function loadPdfKit(): Promise<any> {
  try {
    const mod = require("pdfkit");
    return typeof mod === "function" ? mod : mod.default ?? mod;
  } catch {
    throw new Error("pdfkit not found — run: npm install pdfkit @types/pdfkit");
  }
}
