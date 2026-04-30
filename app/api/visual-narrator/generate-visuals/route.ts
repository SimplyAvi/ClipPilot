import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { buildVisualPromptWithTheme } from "@/lib/themes/theme-context";
import { createSdxlPrediction, waitForReplicatePrediction } from "@/lib/replicate";
import { getProviderKey } from "@/lib/provider-keys";

const BodySchema = z.object({
  projectId: z.string().min(1),
  segmentIds: z.array(z.string()).optional(),
});

const NEGATIVE_PROMPT = "person, people, human, face, body, silhouette, hands, figure, crowd, man, woman, child, portrait, character";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id: parsed.data.projectId },
    include: {
      theme: true,
      visualSegments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) return NextResponse.json({ data: null, error: "Project not found" }, { status: 404 });

  const targets = project.visualSegments.filter((segment) => !parsed.data.segmentIds || parsed.data.segmentIds.includes(segment.id));
  if (targets.length === 0) return NextResponse.json({ data: null, error: "No segments selected" }, { status: 422 });

  const token = await getProviderKey("replicate");
  if (!token) {
    return NextResponse.json({ data: null, error: "Add your Replicate API key in Settings -> AI Providers to generate visual segments." }, { status: 503 });
  }

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const outputs = [];

  for (const segment of targets) {
    await db.visualSegment.update({ where: { id: segment.id }, data: { status: "generating" } });
    const basePrompt = `${segment.visualConcept}. ${segment.primarySubject} shown in detail. ${segment.movementStyle} camera movement. ${segment.cameraApproach} framing. ${segment.colorTemperature} color temperature. No people, no human figures, no faces, no hands, no silhouettes, no body parts. Purely environmental, natural, or abstract imagery. Negative prompt must exclude: ${NEGATIVE_PROMPT}.`;
    const prompt = buildVisualPromptWithTheme(basePrompt, project.theme);
    const variantCount = Math.max(1, Math.min(project.variantCount, 3));

    try {
      const variants: string[] = [];
      for (let index = 0; index < variantCount; index++) {
        const prediction = await createSdxlPrediction(token, `${prompt} Variant ${index + 1}: distinct composition, same emotional intent.`);
        const urls = prediction.output?.length ? prediction.output : await waitForReplicatePrediction(token, prediction.urls.get);
        const imageUrl = urls[0];
        if (!imageUrl) throw new Error("Replicate returned no image");
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`Could not download generated image: ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const path = `${projectSlug}/visual_narrator/segments/seg_${String(segment.sortOrder + 1).padStart(2, "0")}_v${index + 1}.png`;
        const stored = await storage.save(path, buffer, "image/png", {
          projectId: project.id,
          segmentId: segment.id,
          provider: "replicate",
          negativePrompt: NEGATIVE_PROMPT,
        });
        variants.push(stored.path);
      }
      const updated = await db.visualSegment.update({
        where: { id: segment.id },
        data: {
          generationPrompt: prompt,
          generatedVideoPath: variants[0],
          variantPaths: JSON.stringify(variants),
          approvedVariantIdx: 0,
          status: variantCount > 1 ? "needs_review" : "generated",
        },
      });
      outputs.push(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Visual generation failed";
      await db.visualSegment.update({
        where: { id: segment.id },
        data: { status: "failed", additionalNotes: message },
      });
    }
  }

  return NextResponse.json({ data: { segments: outputs }, error: null });
}
