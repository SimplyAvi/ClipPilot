/**
 * DELETE /api/social/accounts/[platform]
 * Disconnects the social account by marking it as not connected.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const { platform } = params;

  const account = await db.socialAccount.findUnique({ where: { platform } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await db.socialAccount.update({
    where: { platform },
    data: { isConnected: false },
  });

  return NextResponse.json({ data: { disconnected: true } });
}
