import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkImageLikeness } from "@/lib/compliance/likeness-check";
import { getProviderKey } from "@/lib/provider-keys";
import { storage } from "@/lib/storage";
import { characterPortraitPath, slugify } from "@/lib/storage/naming";
import { appendGenerationLog } from "@/lib/storage/generation-log";

const GeneratePortraitSchema = z.object({
  characterId: z.string().min(1),
  physicalDescription: z.string().min(10).max(4000),
  age: z.number().int().min(5).max(100),
  gender: z.string().min(1).max(60),
  ethnicity: z.string().min(1).max(120),
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
    const prediction = await createReplicatePrediction(token, portraitPrompt);
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

async function createReplicatePrediction(token: string, prompt: string) {
  const res = await fetch("https://api.replicate.com/v1/models/stability-ai/sdxl/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        prompt,
        negative_prompt:
          "real person, celebrity, public figure, politician, athlete, logo, text, watermark, brand, copyright, trademarked",
        width: 768,
        height: 1024,
        num_outputs: 3,
      },
    }),
  });
  if (!res.ok) throw new Error(`Replicate failed: ${res.status}`);
  return res.json() as Promise<{ urls: { get: string }; output?: string[]; status: string }>;
}

async function waitForReplicatePrediction(token: string, getUrl: string): Promise<string[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const prediction = (await res.json()) as { status: string; output?: string[]; error?: string };
    if (prediction.status === "succeeded" && prediction.output) return prediction.output;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error ?? "Replicate prediction failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Replicate prediction timed out");
}
