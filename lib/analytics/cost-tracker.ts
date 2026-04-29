/**
 * lib/analytics/cost-tracker.ts
 *
 * Records AI provider costs to the ProjectCost table and provides
 * aggregation helpers used by the analytics dashboard.
 *
 * All functions are designed to be fire-and-forget — they log errors
 * rather than throwing so callers don't need try/catch.
 */

import { db } from "@/lib/db";

// ─── Pricing constants (USD) ──────────────────────────────────────────────────

/** Anthropic claude-sonnet-4-5: $3 / 1M input + $15 / 1M output tokens.
 *  We use a blended estimate of ~$6 / 1M total tokens for simplicity. */
export const ANTHROPIC_COST_PER_TOKEN = 6 / 1_000_000;

/** Runway Gen-3 Alpha Turbo: ~$0.05 / second of video */
export const RUNWAY_COST_PER_SECOND = 0.05;

/** ElevenLabs Creator plan: ~$0.30 / 1000 characters */
export const ELEVENLABS_COST_PER_CHAR = 0.30 / 1000;

// ─── Record ───────────────────────────────────────────────────────────────────

/**
 * Record a single AI API cost. Fire-and-forget — never throws.
 */
export async function recordCost(
  projectId: string,
  provider: string,
  jobType: string,
  tokenCount: number | null,
  durationSeconds: number | null,
  cost: number
): Promise<void> {
  try {
    await db.projectCost.create({
      data: {
        projectId,
        provider,
        jobType,
        tokenCount,
        durationSeconds,
        cost,
      },
    });
  } catch (err) {
    // Non-blocking: log and continue
    console.warn(`[cost-tracker] Failed to record cost for project ${projectId}:`, err);
  }
}

// ─── Helpers for common providers ────────────────────────────────────────────

export async function recordAnthropicCost(
  projectId: string,
  jobType: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const totalTokens = inputTokens + outputTokens;
  const cost =
    (inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000;
  await recordCost(projectId, "anthropic", jobType, totalTokens, null, cost);
}

export async function recordRunwayCost(
  projectId: string,
  durationSeconds: number
): Promise<void> {
  const cost = durationSeconds * RUNWAY_COST_PER_SECOND;
  await recordCost(projectId, "runway", "video_generation", null, durationSeconds, cost);
}

export async function recordElevenLabsCost(
  projectId: string,
  charCount: number
): Promise<void> {
  const cost = charCount * ELEVENLABS_COST_PER_CHAR;
  await recordCost(projectId, "elevenlabs", "voice_generation", charCount, null, cost);
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/** Total cost for a project in USD */
export async function getProjectCost(projectId: string): Promise<number> {
  const result = await db.projectCost.aggregate({
    where: { projectId },
    _sum: { cost: true },
  });
  return result._sum.cost ?? 0;
}

/** Cost breakdown by provider for a project */
export async function getCostByProvider(
  projectId: string
): Promise<Record<string, number>> {
  const rows = await db.projectCost.groupBy({
    by: ["provider"],
    where: { projectId },
    _sum: { cost: true },
  });
  const breakdown: Record<string, number> = {};
  for (const row of rows) {
    breakdown[row.provider] = row._sum.cost ?? 0;
  }
  return breakdown;
}

/** Total spend across all projects */
export async function getTotalSpend(): Promise<number> {
  const result = await db.projectCost.aggregate({ _sum: { cost: true } });
  return result._sum.cost ?? 0;
}

/** Per-project cost map: { [projectId]: totalCost } */
export async function getCostPerProject(): Promise<Record<string, number>> {
  const rows = await db.projectCost.groupBy({
    by: ["projectId"],
    _sum: { cost: true },
    orderBy: { _sum: { cost: "desc" } },
    take: 20,
  });
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.projectId] = row._sum.cost ?? 0;
  }
  return map;
}
