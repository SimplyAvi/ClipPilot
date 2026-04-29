/**
 * POST /api/thumbnails/generate
 *
 * Generates 3 thumbnail variants for a project:
 *  A. Impact Frame — best extracted video frame + color grade
 *  B. Character Focus — AI portrait via Replicate
 *  C. Mood/Atmosphere — AI establishing shot via Replicate
 *
 * Body: { projectId: string, style?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { db } from "@/lib/db";
import { downloadFromR2, storage } from "@/lib/storage";
import { slugify, thumbnailPath } from "@/lib/storage/naming";
import { extractBestFrame } from "@/lib/thumbnails/frame-extractor";
import {
  generateImpactFrame,
  generateCharacterFocus,
  generateMoodAtmosphere,
  type ThumbnailTextOptions,
  type ProjectMetadata,
} from "@/lib/thumbnails/generator";

// ─── Validation ────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  projectId: z.string().min(1),
  titleText: z.string().optional(),
  fontSize: z.enum(["small", "medium", "large"]).default("large"),
  textColor: z.enum(["white", "yellow", "black", "red"]).default("white"),
  textPosition: z.enum(["bottom", "center", "top"]).default("bottom"),
  textStyle: z.enum(["plain", "bold", "shadow", "outline"]).default("shadow"),
});

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { projectId } = body;

  // 1. Load project + most recent completed export (for video), characters, script
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      exports: {
        where: { status: "COMPLETE", videoR2Key: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      projectCharacters: {
        include: { character: { select: { name: true, physicalDescription: true } } },
      },
      scripts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { parsedData: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 2. Parse metadata from script's parsedData
  const parsedData = project.scripts[0]?.parsedData as Record<string, unknown> | null;
  const genre = (parsedData?.genre as string) ?? "drama";
  const tone = (parsedData?.tone as string) ?? "cinematic";
  const logline = (parsedData?.logline as string) ?? undefined;

  // Extract first scene/location from parsed data if available
  const scenes = (parsedData?.scenes as Array<{ location?: string; timeOfDay?: string }>) ?? [];
  const firstScene = scenes[0];

  const metadata: ProjectMetadata = {
    title: project.name,
    genre,
    tone,
    logline,
    characters: project.projectCharacters.map(({ character: c }) => ({
      name: c.name,
      description: c.physicalDescription,
    })),
    location: firstScene?.location,
    timeOfDay: firstScene?.timeOfDay,
  };

  const textOptions: ThumbnailTextOptions = {
    title: body.titleText ?? project.name,
    fontSize: body.fontSize,
    textColor: body.textColor,
    textPosition: body.textPosition,
    textStyle: body.textStyle,
  };

  // 3. Download video for frame extraction
  const videoExport = project.exports[0];
  let bestFramePath: string | null = null;
  let tmpDir: string | null = null;
  let tmpVideoPath: string | null = null;
  let canExtractFrames = false;

  if (videoExport?.videoR2Key) {
    try {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cp-thumb-"));
      tmpVideoPath = path.join(tmpDir, "video.mp4");
      const videoBuf = await downloadFromR2(videoExport.videoR2Key);
      await fs.writeFile(tmpVideoPath, videoBuf);
      bestFramePath = await extractBestFrame(tmpVideoPath);
      canExtractFrames = true;
    } catch {
      // No video or frame extraction failed — fall back to pure AI variants
      canExtractFrames = false;
    }
  } else {
    // Warn but don't block — generate B & C without A
  }

  try {
    // 4. Generate all 3 variants in parallel (where possible)
    const [variantB, variantC] = await Promise.all([
      generateCharacterFocus(metadata, textOptions),
      generateMoodAtmosphere(metadata, textOptions),
    ]);

    let variantA = null;
    if (canExtractFrames && bestFramePath) {
      variantA = await generateImpactFrame(bestFramePath, metadata, textOptions);
    }

    // 5. Upload all sizes to R2 and save to DB
    const savedThumbnails = [];

    for (const variant of [variantA, variantB, variantC]) {
      if (!variant) continue;

      const projectSlug = project.projectSlug ?? slugify(project.name);
      const [youtubeKey, tiktokKey, squareKey] = await Promise.all([
        storage.save(thumbnailPath(projectSlug, variant.variant.toLowerCase(), "youtube"), variant.youtubeBuffer, "image/jpeg"),
        storage.save(thumbnailPath(projectSlug, variant.variant.toLowerCase(), "tiktok"), variant.tiktokBuffer, "image/jpeg"),
        storage.save(thumbnailPath(projectSlug, variant.variant.toLowerCase(), "square"), variant.squareBuffer, "image/jpeg"),
      ]);

      // Delete any existing record for this variant+project and re-create
      await db.projectThumbnail.deleteMany({
        where: { projectId, variant: variant.variant },
      });

      const saved = await db.projectThumbnail.create({
        data: {
          projectId,
          variant: variant.variant,
          youtubeR2Key: youtubeKey.path,
          tiktokR2Key: tiktokKey.path,
          squareR2Key: squareKey.path,
          titleText: textOptions.title,
          fontSize: textOptions.fontSize,
          textColor: textOptions.textColor,
          textPosition: textOptions.textPosition,
          textStyle: textOptions.textStyle,
          prompt: variant.prompt ?? null,
          isSelected: variant.variant === "IMPACT_FRAME" && canExtractFrames
            ? true
            : variant.variant === "CHARACTER_FOCUS" && !canExtractFrames
            ? true
            : false,
        },
      });
      savedThumbnails.push(saved);
    }

    // Ensure at most one is selected
    const selectedIdx = savedThumbnails.findIndex((t) => t.isSelected);
    if (selectedIdx === -1 && savedThumbnails.length > 0) {
      await db.projectThumbnail.update({
        where: { id: savedThumbnails[0].id },
        data: { isSelected: true },
      });
      savedThumbnails[0].isSelected = true;
    }

    return NextResponse.json({
      data: {
        thumbnails: savedThumbnails,
        noVideoWarning: !videoExport?.videoR2Key
          ? "Render the video in Phase 7 before generating thumbnails — Impact Frame variant skipped"
          : null,
        noReplicateWarning: !process.env.REPLICATE_API_TOKEN
          ? "Add your Replicate API key in Settings to generate AI thumbnails. You can still use frame extraction only."
          : null,
      },
    });
  } finally {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
