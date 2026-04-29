/**
 * GET /api/themes/[id]/frame/[frameIndex]
 *
 * Serves a theme reference frame as a JPEG image.
 * Reads from [localStorageRoot]/themes/[themeId]/frame_[N].jpg
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getLocalStoragePath } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; frameIndex: string } }
) {
  try {
    const theme = await db.theme.findUnique({
      where: { id: params.id },
      select: { referenceFramePaths: true },
    });

    if (!theme) {
      return new NextResponse("Theme not found", { status: 404 });
    }

    // Try stored frame paths first
    if (theme.referenceFramePaths) {
      const paths: string[] = JSON.parse(theme.referenceFramePaths);
      const idx = parseInt(params.frameIndex, 10);
      const framePath = paths[idx];
      if (framePath && fs.existsSync(framePath)) {
        const buffer = fs.readFileSync(framePath);
        return new NextResponse(buffer, {
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "max-age=3600" },
        });
      }
    }

    // Fallback: look in the standard theme folder
    const storageRoot = await getLocalStoragePath();
    const idx = parseInt(params.frameIndex, 10);
    const frameFile = `frame_${String(idx + 1).padStart(3, "0")}.jpg`;
    const framePath = path.join(storageRoot, "themes", params.id, frameFile);

    if (!fs.existsSync(framePath)) {
      return new NextResponse("Frame not found", { status: 404 });
    }

    const buffer = fs.readFileSync(framePath);
    return new NextResponse(buffer, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "max-age=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(message, { status: 500 });
  }
}
