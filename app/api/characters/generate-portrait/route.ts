import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkImageLikeness } from "@/lib/compliance/likeness-check";
import { getProviderKey } from "@/lib/provider-keys";
import { createSdxlPrediction, waitForReplicatePrediction } from "@/lib/replicate";
import { storage } from "@/lib/storage";
import { characterPortraitPath, slugify } from "@/lib/storage/naming";
import { appendGenerationLog } from "@/lib/storage/generation-log";

const GeneratePortraitSchema = z.object({
  characterId: z.string().min(1),
  physicalDescription: z.string().min(10).max(4000),
  age: z.number().int().min(5).max(100),
  gender: z.string().min(1).max(120),
  ethnicity: z.string().min(1).max(1000),
  style: z.enum(["cinematic-realistic", "stylized", "illustrated", "noir"]),
});

const STYLE_DESCRIPTIONS = {
  "cinematic-realistic":
    "photorealistic cinematic film still, natural skin texture, dramatic directional lighting",
  stylized:
    "stylized digital art, slightly illustrated quality, vivid colors, sharp details",
  illustrated:
    "detailed character illustration, graphic novel style, bold lines, rich colors",
  noir:
    "high contrast black and white film noir photography, deep shadows, moody atmosphere",
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GeneratePortraitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const token = await getProviderKey("replicate");
  if (!token) {
    return NextResponse.json(
      {
        data: null,
        error: "Add your Replicate API key in Settings -> AI Providers to generate character portraits",
      },
      { status: 503 }
    );
  }

  const { characterId, physicalDescription, age, gender, ethnicity, style } = parsed.data;
  const character = await db.character.findUnique({
    where: { id: characterId },
    include: { projectCharacters: { include: { project: { select: { projectSlug: true, name: true } } }, take: 1 } },
  });
  if (!character) {
    return NextResponse.json({ data: null, error: "Character not found" }, { status: 404 });
  }

  const portraitPrompt = `
Professional character portrait photograph for a film production.
${gender}, approximately ${age} years old, ${ethnicity}.
Physical appearance: ${physicalDescription}.
Style: ${STYLE_DESCRIPTIONS[style]}.
Cinematic lighting, shallow depth of field, neutral background,
direct eye contact with camera, expressive face showing depth of character.
Ultra-detailed, production-quality portrait.
IMPORTANT: Entirely fictional person. Not based on or resembling any real,
living, or deceased person. No logos, no text, no brand marks.
Entirely fictional person - not based on or resembling any real person, living or deceased.
`.trim();

  try {
    const prediction = await createSdxlPrediction(token, portraitPrompt);
    const outputUrls = await waitForReplicatePrediction(token, prediction.urls.get);

    const variants = await Promise.all(
      outputUrls.slice(0, 3).map(async (url, index) => {
        const imageRes = await fetch(url);
        if (!imageRes.ok) throw new Error("Generated image download failed");
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
        const likeness = await checkImageLikeness(imageBuffer, `${characterId}-portrait-${index + 1}`);
        const flagged = likeness.outcome === "flagged";

        if (flagged) {
          await db.characterPortraitGeneration.create({
            data: {
              characterId,
              imagePath: "",
              prompt: portraitPrompt,
              style,
              flagged: true,
              flaggedReason: likeness.reason,
            },
          });
          return {
            url: null,
            flagged: true,
            message: "Portrait flagged - regenerate or adjust description",
            reason: likeness.reason,
          };
        }

        const projectSlug =
          character.projectCharacters?.[0]?.project.projectSlug ??
          (character.projectCharacters?.[0]?.project.name ? slugify(character.projectCharacters[0].project.name) : "character_library");
        const key = characterPortraitPath(projectSlug, slugify(character.name), Date.now() + index);
        const stored = await storage.save(key, imageBuffer, imageRes.headers.get("content-type") ?? "image/png", {
          characterId,
          provider: "replicate",
          style,
        });
        await db.characterPortraitGeneration.create({
          data: { characterId, imagePath: stored.path, prompt: portraitPrompt, style },
        });
        await appendGenerationLog(projectSlug, {
          timestamp: new Date().toISOString(),
          type: "image",
          provider: "replicate",
          model: "stability-ai/sdxl",
          outputPath: stored.path,
          cost: 0,
          status: "success",
        }).catch(() => undefined);
        return { url: stored.path, flagged: false, message: null, reason: null };
      })
    );

    return NextResponse.json({ data: { prompt: portraitPrompt, variants }, error: null });
  } catch (err) {
    console.error("[POST /api/characters/generate-portrait]", err);
    return NextResponse.json(
      { data: null, error: "Portrait generation failed. Try adjusting the physical description and regenerating." },
      { status: 502 }
    );
  }
}
