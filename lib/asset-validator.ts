import { db } from "@/lib/db";
import type { Asset, AssetType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClearanceStatus = "CLEARED" | "NEEDS_REVIEW" | "BLOCKED";

export interface AssetValidationResult {
  assetId: string;
  name: string;
  type: AssetType;
  status: ClearanceStatus;
  reasons: string[]; // human-readable reasons for non-cleared status
}

export interface ValidationReport {
  cleared: AssetValidationResult[];
  needsReview: AssetValidationResult[];
  blocked: AssetValidationResult[];
  allClear: boolean;
  summary: string;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Determines the clearance status of a single asset.
 *
 * Rules (in priority order):
 * BLOCKED  — commercialUse=false OR monetizationAllowed=false
 *            OR (MUSIC and contentIdChecked=true and contentIdClear=false)
 * NEEDS_REVIEW — commercialUse=null OR monetizationAllowed=null
 *               OR (MUSIC and contentIdChecked=false)
 * CLEARED  — everything passes
 */
export function getAssetClearanceStatus(asset: Asset): AssetValidationResult {
  const reasons: string[] = [];
  let status: ClearanceStatus = "CLEARED";

  // ── Hard blocks ──────────────────────────────────────────────────────────
  if (asset.commercialUse === false) {
    reasons.push("Commercial use is not permitted");
    status = "BLOCKED";
  }
  if (asset.monetizationAllowed === false) {
    reasons.push("Monetized content is not permitted");
    status = "BLOCKED";
  }
  if (asset.type === "MUSIC" && asset.contentIdChecked && !asset.contentIdClear) {
    reasons.push("Failed Content ID pre-check — high copyright risk");
    status = "BLOCKED";
  }

  // ── Needs review (only if not already blocked) ───────────────────────────
  if (status !== "BLOCKED") {
    if (asset.commercialUse === null) {
      reasons.push("Commercial use status is unknown — verify license");
      status = "NEEDS_REVIEW";
    }
    if (asset.monetizationAllowed === null) {
      reasons.push("Monetization permission is unknown — verify license");
      status = "NEEDS_REVIEW";
    }
    if (asset.type === "MUSIC" && !asset.contentIdChecked) {
      reasons.push("Content ID pre-check has not been run");
      status = "NEEDS_REVIEW";
    }
  }

  return { assetId: asset.id, name: asset.name, type: asset.type, status, reasons };
}

/**
 * Validates a list of asset IDs and returns a full report.
 * Assets that are BLOCKED will prevent a generation job from starting.
 */
export async function validateAssets(assetIds: string[]): Promise<ValidationReport> {
  if (assetIds.length === 0) {
    return {
      cleared: [],
      needsReview: [],
      blocked: [],
      allClear: true,
      summary: "No assets to validate.",
    };
  }

  const assets = await db.asset.findMany({
    where: { id: { in: assetIds } },
  });

  const missingIds = assetIds.filter((id) => !assets.find((a) => a.id === id));
  const results = assets.map(getAssetClearanceStatus);

  const cleared = results.filter((r) => r.status === "CLEARED");
  const needsReview = results.filter((r) => r.status === "NEEDS_REVIEW");
  const blocked = results.filter((r) => r.status === "BLOCKED");

  // Missing assets count as blocked
  missingIds.forEach((id) => {
    blocked.push({
      assetId: id,
      name: "Unknown",
      type: "AUDIO",
      status: "BLOCKED",
      reasons: ["Asset not found in database"],
    });
  });

  const allClear = blocked.length === 0;

  let summary: string;
  if (allClear && needsReview.length === 0) {
    summary = `All ${cleared.length} asset(s) cleared for use.`;
  } else if (blocked.length > 0) {
    summary = `${blocked.length} asset(s) BLOCKED, ${needsReview.length} need review, ${cleared.length} cleared.`;
  } else {
    summary = `${needsReview.length} asset(s) need review before use, ${cleared.length} cleared.`;
  }

  return { cleared, needsReview, blocked, allClear, summary };
}

/**
 * Convenience check — returns true only if ALL assets in the list are CLEARED.
 * Use this as a gate before enqueuing a generation job.
 */
export async function areAssetsReadyForGeneration(assetIds: string[]): Promise<boolean> {
  const report = await validateAssets(assetIds);
  return report.allClear && report.needsReview.length === 0;
}
