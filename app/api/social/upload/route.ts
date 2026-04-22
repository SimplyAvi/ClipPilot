/**
 * POST /api/social/upload
 *
 * Triggers a social media upload for a given project export.
 * Downloads the export video from R2, uploads to the target platform,
 * and saves a SocialPost record on success.
 *
 * Body: {
 *   projectId: string,
 *   exportId: string,
 *   platform: "youtube" | "tiktok" | "instagram",
 *   // YouTube-specific
 *   title?: string,
 *   description?: string,
 *   tags?: string[],
 *   categoryId?: string,
 *   privacyStatus?: "public" | "private" | "unlisted",
 *   madeForKids?: boolean,
 *   // TikTok-specific
 *   caption?: string,
 *   hashtags?: string[],
 *   privacyLevel?: string,
 *   disableDuet?: boolean,
 *   disableStitch?: boolean,
 *   disableComment?: boolean,
 *   // Instagram-specific
 *   shareToFeed?: boolean,
 *   // Scheduling (stored for UI feedback — actual scheduling via platform APIs if supported)
 *   scheduledAt?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/storage";
import { getValidToken } from "@/lib/social/token-manager";
import { uploadToYouTube, YOUTUBE_SHORTS_MAX_SEC } from "@/lib/social/youtube-uploader";
import { uploadToTikTok, TIKTOK_MAX_SEC } from "@/lib/social/tiktok-uploader";
import { uploadToInstagram, INSTAGRAM_MAX_SEC } from "@/lib/social/instagram-uploader";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";

const BodySchema = z.object({
  projectId: z.string(),
  exportId: z.string(),
  platform: z.enum(["youtube", "tiktok", "instagram"]),
  // YouTube
  title: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().optional().default("22"),
  privacyStatus: z.enum(["public", "private", "unlisted"]).optional().default("unlisted"),
  madeForKids: z.boolean().optional().default(false),
  // TikTok
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional(),
  privacyLevel: z.enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]).optional().default("SELF_ONLY"),
  disableDuet: z.boolean().optional().default(true),
  disableStitch: z.boolean().optional().default(true),
  disableComment: z.boolean().optional().default(false),
  // Instagram
  shareToFeed: z.boolean().optional().default(true),
  // Scheduling
  scheduledAt: z.string().datetime().optional(),
});

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  const { projectId, exportId, platform } = body;

  // ── Verify account is connected ───────────────────────────────────────────
  try {
    await getValidToken(platform);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  // ── Load export record ────────────────────────────────────────────────────
  const exportRecord = await db.export.findFirst({
    where: { id: exportId, projectId, status: "COMPLETE" },
  });

  if (!exportRecord || !exportRecord.videoR2Key) {
    return NextResponse.json(
      { error: "Export not found or not yet complete" },
      { status: 404 }
    );
  }

  // ── Duration check ────────────────────────────────────────────────────────
  const durationSec = exportRecord.durationSec ?? 0;
  const platformLimits: Record<string, { maxSec: number; name: string }> = {
    YOUTUBE_SHORTS: { maxSec: YOUTUBE_SHORTS_MAX_SEC, name: "YouTube Shorts" },
    YOUTUBE_STANDARD: { maxSec: 43200, name: "YouTube" },
    TIKTOK: { maxSec: TIKTOK_MAX_SEC, name: "TikTok" },
    INSTAGRAM_REELS: { maxSec: INSTAGRAM_MAX_SEC, name: "Instagram Reels" },
  };
  const limit = platformLimits[exportRecord.platform];
  if (limit && durationSec > limit.maxSec) {
    return NextResponse.json(
      {
        error: `This video is ${Math.round(durationSec)} seconds. ${limit.name} allows ${limit.maxSec} seconds maximum. Use the Short cut version instead.`,
      },
      { status: 422 }
    );
  }

  // ── Download video from R2 to temp file ───────────────────────────────────
  const tempPath = join(tmpdir(), `clippilot-upload-${exportId}.mp4`);
  let tempThumbnailPath: string | null = null;

  try {
    const videoUrl = await getSignedViewUrl(exportRecord.videoR2Key, 3600);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Failed to download export video from storage");
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(tempPath, videoBuffer);

    // Download selected thumbnail if available
    const selectedThumb = await db.projectThumbnail.findFirst({
      where: { projectId, isSelected: true, youtubeR2Key: { not: null } },
      select: { youtubeR2Key: true },
    });
    if (selectedThumb?.youtubeR2Key) {
      try {
        const thumbUrl = await getSignedViewUrl(selectedThumb.youtubeR2Key, 3600);
        const thumbRes = await fetch(thumbUrl);
        if (thumbRes.ok) {
          tempThumbnailPath = join(tmpdir(), `clippilot-thumb-${exportId}.jpg`);
          await writeFile(tempThumbnailPath, Buffer.from(await thumbRes.arrayBuffer()));
        }
      } catch { /* non-fatal */ }
    }

    // ── Upload to platform ─────────────────────────────────────────────────
    let postUrl: string;
    let platformPostId: string;
    const title = body.title ?? "Untitled";
    const caption = body.caption ?? body.description ?? "";

    if (platform === "youtube") {
      const result = await uploadToYouTube({
        videoPath: tempPath,
        title,
        description: body.description ?? "",
        tags: body.tags ?? [],
        thumbnailPath: tempThumbnailPath,
        categoryId: body.categoryId ?? "22",
        privacyStatus: body.privacyStatus ?? "unlisted",
        madeForKids: body.madeForKids ?? false,
        containsSyntheticMedia: true, // Always true per compliance rules
      });
      platformPostId = result.videoId;
      postUrl = result.videoUrl;
    } else if (platform === "tiktok") {
      // Get public video URL for PULL_FROM_URL
      const publicVideoUrl = await getSignedViewUrl(exportRecord.videoR2Key, 3600);
      const result = await uploadToTikTok({
        videoPath: tempPath,
        publicVideoUrl,
        caption: body.caption ?? "",
        hashtags: body.hashtags ?? [],
        privacyLevel: body.privacyLevel ?? "SELF_ONLY",
        disableDuet: body.disableDuet ?? true,
        disableStitch: body.disableStitch ?? true,
        disableComment: body.disableComment ?? false,
      });
      platformPostId = result.publishId;
      postUrl = result.shareUrl;
    } else {
      // instagram
      const publicVideoUrl = await getSignedViewUrl(exportRecord.videoR2Key, 7200);
      let coverImageUrl: string | null = null;
      if (selectedThumb?.youtubeR2Key) {
        try {
          coverImageUrl = await getSignedViewUrl(selectedThumb.youtubeR2Key, 7200);
        } catch { /* non-fatal */ }
      }
      const result = await uploadToInstagram({
        videoPath: tempPath,
        publicVideoUrl,
        caption: body.caption ?? body.description ?? "",
        coverImageUrl,
        shareToFeed: body.shareToFeed ?? true,
      });
      platformPostId = result.mediaId;
      postUrl = result.permalink;
    }

    // ── Save SocialPost record ─────────────────────────────────────────────
    await db.socialPost.create({
      data: {
        projectId,
        platform,
        platformPostId,
        postUrl,
        title,
        caption,
        status: "published",
      },
    });

    return NextResponse.json({
      data: {
        platform,
        platformLabel: PLATFORM_LABELS[platform] ?? platform,
        postUrl,
        platformPostId,
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Cleanup temp files
    try { await unlink(tempPath); } catch { /* ignore */ }
    if (tempThumbnailPath) {
      try { await unlink(tempThumbnailPath); } catch { /* ignore */ }
    }
  }
}
