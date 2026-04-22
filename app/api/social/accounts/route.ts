/**
 * GET /api/social/accounts
 * Returns all connected social accounts (without decrypting tokens).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const accounts = await db.socialAccount.findMany({
    select: {
      platform: true,
      username: true,
      platformUserId: true,
      tokenExpiresAt: true,
      isConnected: true,
      updatedAt: true,
    },
    orderBy: { platform: "asc" },
  });

  return NextResponse.json({ data: accounts });
}
