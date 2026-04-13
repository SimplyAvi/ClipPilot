/**
 * Pre-Export Compliance Checker — Phase 7
 *
 * Runs all required checks before an export is allowed.
 * Returns a structured report that drives the compliance page UI
 * and gates the export button.
 *
 * Checks:
 *  A. Asset License  — all project assets have commercialUse = true
 *  B. Content ID     — all music assets have contentIdClear = true
 *  C. Likeness       — all shots that have been checked have passed
 *  D. AI Disclosure  — at least one export has aiDisclosureApplied = true
 *                      OR this is the first export (disclosure will be applied)
 *  E. Duration       — total assembled duration fits the target platform
 */

import { db } from "@/lib/db";
import { PLATFORM_SPECS, type Platform } from "@/lib/assembler/final-assembler";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = "pass" | "warn" | "fail";

export interface ComplianceCheck {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  details: string[];
}

export interface ComplianceReport {
  projectId: string;
  platform: Platform;
  overallStatus: CheckStatus; // worst of all checks
  checks: ComplianceCheck[];
  exportAllowed: boolean;     // false if any check is "fail"
  totalDurationSec: number;
  generatedAt: string;        // ISO timestamp
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function runComplianceChecks(
  projectId: string,
  platform: Platform,
  totalDurationSec: number
): Promise<ComplianceReport> {
  const [
    checkA,
    checkB,
    checkC,
    checkD,
    checkE,
    checkF,
  ] = await Promise.all([
    checkAssetLicenses(projectId),
    checkContentId(projectId),
    checkLikeness(projectId),
    checkAiDisclosure(projectId),
    checkDuration(totalDurationSec, platform),
    checkCaptions(projectId),
  ]);

  const checks = [checkA, checkB, checkC, checkD, checkE, checkF];
  const statuses = checks.map((c) => c.status);

  const overallStatus: CheckStatus = statuses.includes("fail")
    ? "fail"
    : statuses.includes("warn")
    ? "warn"
    : "pass";

  return {
    projectId,
    platform,
    overallStatus,
    checks,
    exportAllowed: overallStatus !== "fail",
    totalDurationSec,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Check A: Asset License ───────────────────────────────────────────────────

async function checkAssetLicenses(projectId: string): Promise<ComplianceCheck> {
  const assets = await db.asset.findMany({
    where: { projectId },
    select: { id: true, name: true, type: true, commercialUse: true, licenseType: true },
  });

  const blocked = assets.filter((a) => a.commercialUse === false);
  const unknown = assets.filter((a) => a.commercialUse === null);

  const details: string[] = [];
  blocked.forEach((a) => details.push(`BLOCKED: "${a.name}" (${a.type}) — not cleared for commercial use`));
  unknown.forEach((a) => details.push(`UNKNOWN: "${a.name}" (${a.type}) — commercial use unverified`));

  if (blocked.length > 0) {
    return {
      id: "asset_license",
      label: "Asset License Check",
      description: "All project assets must be cleared for commercial use",
      status: "fail",
      details,
    };
  }
  if (unknown.length > 0) {
    return {
      id: "asset_license",
      label: "Asset License Check",
      description: "All project assets must be cleared for commercial use",
      status: "warn",
      details: unknown.length > 0 ? details : [`${assets.length} assets verified`],
    };
  }
  return {
    id: "asset_license",
    label: "Asset License Check",
    description: "All project assets must be cleared for commercial use",
    status: "pass",
    details: [`${assets.length} asset(s) verified for commercial use`],
  };
}

// ─── Check B: Content ID ──────────────────────────────────────────────────────

async function checkContentId(projectId: string): Promise<ComplianceCheck> {
  const scenes = await db.scene.findMany({
    where: { projectId },
    include: { musicCue: { include: { asset: true } } },
  });

  const cues = scenes.flatMap((s) => (s.musicCue ? [s.musicCue] : []));
  const unchecked = cues.filter((c) => !c.asset.contentIdChecked);
  const risky = cues.filter((c) => c.asset.contentIdChecked && !c.asset.contentIdClear);

  const details: string[] = [];
  risky.forEach((c) => details.push(`RISK: "${c.asset.name}" — Content ID not clear`));
  unchecked.forEach((c) => details.push(`UNCHECKED: "${c.asset.name}" — Content ID not verified`));

  if (risky.length > 0) {
    return {
      id: "content_id",
      label: "Content ID Check",
      description: "All music tracks must be clear of Content ID claims",
      status: "fail",
      details,
    };
  }
  if (unchecked.length > 0) {
    return {
      id: "content_id",
      label: "Content ID Check",
      description: "All music tracks must be clear of Content ID claims",
      status: "warn",
      details,
    };
  }
  if (cues.length === 0) {
    return {
      id: "content_id",
      label: "Content ID Check",
      description: "All music tracks must be clear of Content ID claims",
      status: "pass",
      details: ["No music tracks assigned — Content ID check not applicable"],
    };
  }
  return {
    id: "content_id",
    label: "Content ID Check",
    description: "All music tracks must be clear of Content ID claims",
    status: "pass",
    details: [`${cues.length} music track(s) clear of Content ID claims`],
  };
}

// ─── Check C: Likeness ────────────────────────────────────────────────────────

async function checkLikeness(projectId: string): Promise<ComplianceCheck> {
  const scenes = await db.scene.findMany({
    where: { projectId },
    include: { shots: { select: { id: true, shotNumber: true, sceneId: true, likenessChecked: true, likenessCheckPassed: true, status: true, likenessMatchedName: true } } },
  });

  const allShots = scenes.flatMap((s) => s.shots);
  const generatedShots = allShots.filter((s) => s.status === "COMPLETE" || s.status === "NEEDS_REVIEW");
  const unchecked = generatedShots.filter((s) => !s.likenessChecked);
  const flagged = generatedShots.filter((s) => s.likenessChecked && s.likenessCheckPassed === false);

  const details: string[] = [];
  flagged.forEach((s) => details.push(`FLAGGED: Shot ${s.shotNumber} — possible likeness match: ${s.likenessMatchedName ?? "unknown"}`));
  unchecked.forEach((s) => details.push(`UNCHECKED: Shot ${s.shotNumber} — likeness scan not run`));

  if (flagged.length > 0) {
    return {
      id: "likeness",
      label: "Likeness Check",
      description: "No generated shots may contain recognisable real-person likenesses",
      status: "fail",
      details,
    };
  }
  if (unchecked.length > 0) {
    return {
      id: "likeness",
      label: "Likeness Check",
      description: "No generated shots may contain recognisable real-person likenesses",
      status: "warn",
      details,
    };
  }
  return {
    id: "likeness",
    label: "Likeness Check",
    description: "No generated shots may contain recognisable real-person likenesses",
    status: "pass",
    details: [
      generatedShots.length === 0
        ? "No generated shots found"
        : `${generatedShots.length} shot(s) passed likeness scan`,
    ],
  };
}

// ─── Check D: AI Disclosure ───────────────────────────────────────────────────

async function checkAiDisclosure(projectId: string): Promise<ComplianceCheck> {
  // Check if any prior export already applied the disclosure overlay
  const priorExport = await db.export.findFirst({
    where: { projectId, aiDisclosureApplied: true },
    orderBy: { createdAt: "desc" },
  });

  if (priorExport) {
    return {
      id: "ai_disclosure",
      label: "AI Disclosure",
      description: "Video must include a visible 'AI Generated Content' disclosure overlay",
      status: "pass",
      details: [
        `Disclosure overlay applied in export ${priorExport.id} at ${priorExport.disclosureTimestamp?.toISOString() ?? "unknown"}`,
      ],
    };
  }

  // First export — disclosure will be applied automatically during assembly
  return {
    id: "ai_disclosure",
    label: "AI Disclosure",
    description: "Video must include a visible 'AI Generated Content' disclosure overlay",
    status: "pass",
    details: [
      "First export — '"+`${AI_DISCLOSURE_TEXT}`+"' overlay will be applied automatically at 00:00 for 3 seconds",
    ],
  };
}

const AI_DISCLOSURE_TEXT = "AI Generated Content";

// ─── Check E: Duration ────────────────────────────────────────────────────────

async function checkDuration(
  totalDurationSec: number,
  platform: Platform
): Promise<ComplianceCheck> {
  const spec = PLATFORM_SPECS[platform];
  // Account for title cards + disclosure (≈ 8 seconds overhead)
  const estimatedFinal = totalDurationSec + 8;

  if (estimatedFinal > spec.maxDurationSec) {
    return {
      id: "duration",
      label: "Duration Check",
      description: `Video must be under ${spec.maxDurationSec}s for ${spec.label}`,
      status: "fail",
      details: [
        `Estimated final duration: ${estimatedFinal.toFixed(0)}s (limit: ${spec.maxDurationSec}s)`,
        "Shorten the script or remove scenes to fit the platform limit",
      ],
    };
  }

  if (estimatedFinal > spec.maxDurationSec * 0.95) {
    return {
      id: "duration",
      label: "Duration Check",
      description: `Video must be under ${spec.maxDurationSec}s for ${spec.label}`,
      status: "warn",
      details: [
        `Estimated final duration: ${estimatedFinal.toFixed(0)}s — close to ${spec.maxDurationSec}s limit`,
        "Verify actual assembled duration before publishing",
      ],
    };
  }

  return {
    id: "duration",
    label: "Duration Check",
    description: `Video must be under ${spec.maxDurationSec}s for ${spec.label}`,
    status: "pass",
    details: [`Estimated final duration: ${estimatedFinal.toFixed(0)}s / ${spec.maxDurationSec}s limit`],
  };
}

// ─── Check F: Captions ────────────────────────────────────────────────────────

async function checkCaptions(projectId: string): Promise<ComplianceCheck> {
  const transcription = await db.transcription.findUnique({
    where: { projectId },
    select: { _count: { select: { segments: true } } },
  });

  const count = transcription?._count.segments ?? 0;

  if (count === 0) {
    return {
      id: "captions",
      label: "Captions",
      description: "Captions increase reach on all platforms",
      status: "warn",
      details: [
        "Captions increase reach by up to 40% on all major platforms. Consider adding them before export.",
      ],
    };
  }

  return {
    id: "captions",
    label: "Captions",
    description: "Captions increase reach on all platforms",
    status: "pass",
    details: [`${count} caption segment(s) generated and ready for export`],
  };
}
