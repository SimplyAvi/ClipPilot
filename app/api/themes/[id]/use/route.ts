/**
 * POST /api/themes/[id]/use
 *
 * Increments the theme's usageCount and returns the full theme config
 * for pre-filling project creation fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const theme = await db.theme.update({
      where: { id: params.id },
      data: { usageCount: { increment: 1 } },
    });
    return NextResponse.json({ data: theme, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
