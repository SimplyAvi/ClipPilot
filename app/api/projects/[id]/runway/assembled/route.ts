import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const assembled = await db.assembledVideo.findUnique({ where: { projectId: params.id } });
  if (!assembled) {
    return NextResponse.json({ data: null, error: "Assembled video not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: { ...assembled, videoUrl: await storage.getUrl(assembled.videoPath) },
    error: null,
  });
}
