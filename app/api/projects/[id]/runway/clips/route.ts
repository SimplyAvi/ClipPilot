import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const clips = await db.runwayClip.findMany({
    where: { projectId: params.id },
    orderBy: [{ sceneIndex: "asc" }, { clipIndex: "asc" }],
  });
  const assembled = await db.assembledVideo.findUnique({ where: { projectId: params.id } });
  const withUrls = await Promise.all(clips.map(async (clip) => ({
    ...clip,
    videoUrl: clip.muxedVideoPath ? await storage.getUrl(clip.muxedVideoPath) : clip.videoPath ? await storage.getUrl(clip.videoPath) : null,
    rawVideoUrl: clip.videoPath ? await storage.getUrl(clip.videoPath) : null,
  })));

  const grouped = withUrls.reduce<Record<string, typeof withUrls>>((acc, clip) => {
    const key = String(clip.sceneIndex);
    acc[key] ??= [];
    acc[key].push(clip);
    return acc;
  }, {});

  return NextResponse.json({
    data: {
      clips: withUrls,
      grouped,
      assembled: assembled ? { ...assembled, videoUrl: await storage.getUrl(assembled.videoPath) } : null,
    },
    error: null,
  });
}
