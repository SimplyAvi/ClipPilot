/**
 * GET /api/settings/provider-status
 *
 * Returns the configured/verified status for every known provider,
 * including isVerified and lastTestedAt from the ProviderKey table.
 *
 * Response shape:
 * {
 *   data: {
 *     anthropic: { configured: boolean, isVerified: boolean, lastTestedAt: string | null },
 *     ...
 *   }
 * }
 */

import { NextResponse } from "next/server";
import { getAllProviderStatus } from "@/lib/provider-keys";

export async function GET() {
  try {
    const data = await getAllProviderStatus();
    return NextResponse.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[provider-status]", message);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
