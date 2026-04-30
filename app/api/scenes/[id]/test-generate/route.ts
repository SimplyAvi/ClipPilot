import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSdxlPrediction, waitForReplicatePrediction } from "@/lib/replicate";
import { selectHeroShot } from "@/lib/preview/hero-shot-selector";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { buildVisualPromptWithTheme } from "@/lib/themes/theme-context";
import { getProviderKey } from "@/lib/provider-keys";

const BodySchema = z.object({
  testMode: z.enum(["quick", "draft", "full"]),
  adjustedConcept: z.string().optional(),
});

const MODE_COST: Record<string, number> = {
  quick: 0.18,
  draft: 0.72,
  full: 3.5,
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const token = await getProviderKey("replicate");
  if (!token) {
    return NextResponse.json(
      { data: null, error: "Add your Replicate API key in Settings -> AI Providers to generate scene tests." },
      { status: 503 }
    );
  }

  const scene = await db.scene.findUnique({
    where: { id: params.id },
    include: { project: { include: { theme: true } }, theme: true },
  });
  const segment = scene
    ? null
    : await db.visualSegment.findUnique({
        where: { id: params.id },
        include: { project: { include: { theme: true } } },
      });

  if (!scene && !segment) {
    return NextResponse.json({ data: null, error: "Scene not found" }, { status: 404 });
  }

  const project = scene?.project ?? segment!.project;
  const theme = scene?.useProjectTheme === false && scene.theme ? scene.theme : project.theme;
  const projectSlug = project.projectSlug ?? slugify(project.name);
  const mode = parsed.data.testMode;
  const started = Date.now();

  const preview = await db.scenePreview.create({
    data: {
      sceneId: scene?.id,
      visualSegmentId: segment?.id,
      projectId: project.id,
      testMode: mode,
      status: "generating",
      totalShots: mode === "quick" ? 1 : mode === "draft" ? 3 : Math.max(1, project.variantCount),
    },
  });

  try {
    const concept = parsed.data.adjustedConcept?.trim();
    const basePrompt = scene
      ? await buildScenePrompt(scene.id, concept)
      : buildSegmentPrompt(segment!, concept);
    const prompt = buildVisualPromptWithTheme(
      `${basePrompt}. Cinematic test preview frame, production quality, no people unless explicitly required, no logos, no text, no watermarks.`,
      theme
    );

    await db.scenePreview.update({
      where: { id: preview.id },
      data: { generationPromptUsed: prompt, themeModifierUsed: theme?.visualPromptModifier ?? null },
    });

    const prediction = await createSdxlPrediction(token, prompt);
    const urls = prediction.output?.length ? prediction.output : await waitForReplicatePrediction(token, prediction.urls.get);
    const imageUrl = urls[0];
    if (!imageUrl) throw new Error("Replicate returned no preview image");

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Could not download preview: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const timestamp = Date.now();
    const sceneSlug = scene ? `sc${String(scene.sceneNumber).padStart(2, "0")}_${slugify(scene.title)}` : `seg_${String(segment!.sortOrder + 1).padStart(2, "0")}`;
    const path = `${projectSlug}/03_scenes/${sceneSlug}/previews/preview_${mode}_${timestamp}.png`;
    const stored = await storage.save(path, buffer, "image/png", {
      projectId: project.id,
      sceneId: scene?.id ?? "",
      visualSegmentId: segment?.id ?? "",
      testMode: mode,
      provider: "replicate",
    });

    const updated = await db.scenePreview.update({
      where: { id: preview.id },
      data: {
        status: "complete",
        shotsGenerated: mode === "quick" ? 1 : mode === "draft" ? 3 : Math.max(1, project.variantCount),
        previewVideoPath: stored.path,
        previewThumbPath: stored.path,
        costActual: MODE_COST[mode],
        durationSeconds: (Date.now() - started) / 1000,
      },
    });

    return NextResponse.json({ data: { preview: updated, viewUrl: await storage.getUrl(stored.path) }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test generation failed";
    const failed = await db.scenePreview.update({
      where: { id: preview.id },
      data: { status: "failed", feedback: message, durationSeconds: (Date.now() - started) / 1000 },
    });
    return NextResponse.json({ data: { preview: failed }, error: message }, { status: 500 });
  }
}

async function buildScenePrompt(sceneId: string, adjustedConcept?: string): Promise<string> {
  const hero = await selectHeroShot(sceneId);
  return adjustedConcept || `${hero.suggestedShotType ?? "Cinematic"} shot: ${hero.description}. Emotional tone: ${hero.emotionalTone ?? "cinematic"}.`;
}

function buildSegmentPrompt(
  segment: {
    visualConcept: string;
    primarySubject: string;
    movementStyle: string;
    cameraApproach: string;
    colorTemperature: string;
    emotionalQuality: string | null;
  },
  adjustedConcept?: string
): string {
  return `${adjustedConcept || segment.visualConcept}. ${segment.primarySubject} shown in detail. ${segment.movementStyle} movement. ${segment.cameraApproach} framing. ${segment.colorTemperature} color temperature. Feeling: ${segment.emotionalQuality ?? "cinematic"}. No human figures, no faces, no hands.`;
}
