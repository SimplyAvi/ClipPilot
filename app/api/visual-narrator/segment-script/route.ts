import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";
import { buildScriptSegmentationPrompt } from "@/lib/prompts/script-segmentation";

const BodySchema = z.object({ projectId: z.string().min(1) });

const SegmentSchema = z.object({
  stanzaIndex: z.number().int().min(0),
  stanzaText: z.string().min(1),
  visualConcept: z.string().min(1),
  primarySubject: z.string().min(1),
  movementStyle: z.string().min(1),
  cameraApproach: z.string().min(1),
  colorTemperature: z.string().min(1),
  emotionalQuality: z.string().optional(),
  estimatedSeconds: z.number().positive(),
  visualPromptBase: z.string().optional(),
});

const SegmentationSchema = z.object({
  segments: z.array(SegmentSchema).min(1),
  totalEstimatedSeconds: z.number().positive(),
  overallEmotionalArc: z.string(),
  recommendedMusicStyle: z.string(),
  narratorPaceRecommendation: z.string(),
});

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
      scripts: { orderBy: { createdAt: "desc" }, take: 1 },
      theme: true,
    },
  });
  if (!project?.scripts[0]) {
    return NextResponse.json({ data: null, error: "Project script not found" }, { status: 404 });
  }

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { data: null, error: "Anthropic API key not configured. Go to Settings -> AI Providers." },
      { status: 503 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const prompt = buildScriptSegmentationPrompt({
      scriptText: project.scripts[0].content,
      genre: project.genre ?? project.theme?.genre,
      tone: project.tone ?? project.theme?.tone,
      visualStyle: project.theme?.visualStyle,
      environmentDescription: project.theme?.environmentDescription,
      colorMood: project.theme?.colorMood,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected Claude response");
    const cleaned = block.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const result = SegmentationSchema.parse(JSON.parse(cleaned));

    await db.project.update({
      where: { id: project.id },
      data: { productionMode: "visual_narrator" },
    });
    await db.visualSegment.deleteMany({ where: { projectId: project.id } });

    const segments = await Promise.all(
      result.segments.map((segment, index) =>
        db.visualSegment.create({
          data: {
            projectId: project.id,
            stanzaIndex: segment.stanzaIndex,
            stanzaText: segment.stanzaText,
            visualConcept: segment.visualConcept,
            primarySubject: segment.primarySubject,
            movementStyle: segment.movementStyle,
            cameraApproach: segment.cameraApproach,
            colorTemperature: segment.colorTemperature,
            emotionalQuality: segment.emotionalQuality,
            durationSeconds: segment.estimatedSeconds,
            generationPrompt: segment.visualPromptBase,
            sortOrder: index,
            status: "concept_pending",
          },
        })
      )
    );

    await db.projectMusicTrack.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        style: result.recommendedMusicStyle,
        mood: project.theme?.musicMood ?? project.tone,
        tempo: project.theme?.musicTempo ?? null,
        emotionalArc: result.overallEmotionalArc,
        status: "pending",
      },
      update: {
        style: result.recommendedMusicStyle,
        mood: project.theme?.musicMood ?? project.tone,
        tempo: project.theme?.musicTempo ?? null,
        emotionalArc: result.overallEmotionalArc,
      },
    });

    await db.narratorProfile.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        pace: normalizePace(result.narratorPaceRecommendation),
        tone: defaultDelivery(project.tone ?? project.theme?.tone),
      },
      update: {
        pace: normalizePace(result.narratorPaceRecommendation),
        tone: defaultDelivery(project.tone ?? project.theme?.tone),
      },
    });

    return NextResponse.json({ data: { ...result, segments }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Segmentation failed";
    console.error("[visual-narrator/segment-script]", err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

function normalizePace(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("slow")) return "slow";
  if (lower.includes("expressive")) return "expressive";
  if (lower.includes("moderate")) return "moderate";
  return "measured";
}

function defaultDelivery(tone?: string | null) {
  const lower = tone?.toLowerCase() ?? "";
  if (lower.includes("tragic") || lower.includes("dark")) return "restrained, carrying weight without breaking";
  if (lower.includes("hopeful")) return "warm and gentle, finding light in the words";
  if (lower.includes("suspense")) return "measured, each word deliberate";
  if (lower.includes("epic")) return "full, resonant, commanding";
  return "quiet, clear, and emotionally present";
}
