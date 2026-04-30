import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkImageLikeness } from "@/lib/compliance/likeness-check";
import { getProviderKey } from "@/lib/provider-keys";
import { createSdxlPrediction, waitForReplicatePrediction } from "@/lib/replicate";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

const RequestSchema = z.object({
  tempId: z.string().min(1),
  themeId: z.string().min(1),
  characterName: z.string().optional().default("generated_character"),
  portraitPrompt: z.string().min(10),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const theme = await db.theme.findUnique({ where: { id: parsed.data.themeId } });
  if (!theme) {
    return NextResponse.json({ data: null, error: "Theme not found" }, { status: 404 });
  }

  const token = await getProviderKey("replicate");
  if (!token) {
    return NextResponse.json({
      data: {
        variants: [],
        missingKey: true,
        message: "Add your Replicate API key in Settings to auto-generate portraits. You can generate one later from the character page.",
      },
      error: null,
    });
  }

  const fullPrompt = [
    parsed.data.portraitPrompt,
    theme.visualPromptModifier,
    "Professional cinematic portrait, film production quality,",
    "no text, no logos, no watermarks,",
    "fictional character only, not based on any real person",
  ].filter(Boolean).join(" ");

  try {
    const prediction = await createSdxlPrediction(token, fullPrompt);
    const outputUrls = await waitForReplicatePrediction(token, prediction.urls.get);
    const characterSlug = slugify(parsed.data.characterName || "generated_character");

    const variants = await Promise.all(outputUrls.slice(0, 3).map(async (url, index) => {
      const imageRes = await fetch(url);
      if (!imageRes.ok) throw new Error("Generated image download failed");
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      const likeness = await checkImageLikeness(imageBuffer, `${parsed.data.tempId}-theme-portrait-${index + 1}`);
      if (likeness.outcome === "flagged") {
        return {
          url: null,
          path: null,
          flagged: true,
          message: "Portrait flagged - regenerate or adjust description",
          reason: likeness.reason,
        };
      }
      const path = `themes/${theme.id}/characters/temp_${parsed.data.tempId}/char_${characterSlug}/portrait_v${index + 1}.png`;
      const stored = await storage.save(path, imageBuffer, imageRes.headers.get("content-type") ?? "image/png", {
        themeId: theme.id,
        tempId: parsed.data.tempId,
        provider: "replicate",
      });
      return { url: stored.path, path: stored.path, flagged: false, message: null, reason: null };
    }));

    return NextResponse.json({ data: { variants, prompt: fullPrompt, missingKey: false }, error: null });
  } catch (err) {
    console.error("[generate-themed-portraits]", err);
    return NextResponse.json(
      { data: null, error: "Portrait generation failed. Try adjusting the physical description and regenerating." },
      { status: 502 }
    );
  }
}
