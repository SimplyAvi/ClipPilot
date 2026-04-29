import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";
import {
  SCRIPT_ANALYSIS_SYSTEM_PROMPT,
  buildScriptAnalysisPrompt,
  type ScriptAnalysis,
} from "@/lib/prompts/script-analysis";
import { recordAnthropicCost } from "@/lib/analytics/cost-tracker";

// ─── Request schema ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  projectName: z.string().min(1, "Project name is required").max(100),
  scriptText: z
    .string()
    .min(50, "Script must be at least 50 characters")
    .max(20000, "Script must be under 20,000 characters"),
  genre: z.enum([
    "thriller", "drama", "romance", "horror", "action",
    "comedy", "fantasy", "sci-fi", "mystery", "documentary", "other",
  ]),
  tone: z.enum([
    "dark", "hopeful", "tragic", "intimate", "epic",
    "suspenseful", "restrained", "playful", "tense",
  ]),
  platform: z.enum([
    "youtube-shorts", "instagram-reels", "tiktok", "youtube-standard",
  ]),
  targetLength: z.enum(["short", "medium", "long", "ai-recommend"]),
});

// ─── Response schema ──────────────────────────────────────────────────────────

const BeatSchema = z.object({
  beatNumber: z.number().int().positive(),
  description: z.string(),
  emotionalShift: z.string(),
  suggestedShotType: z.enum(["wide", "medium", "close-up", "insert", "reaction", "over-shoulder"]),
  estimatedDurationSeconds: z.number().positive(),
});

const SceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  title: z.string(),
  location: z.string(),
  timeOfDay: z.enum(["day", "night", "dawn", "dusk", "interior"]),
  charactersPresent: z.array(z.string()),
  emotionalTone: z.string(),
  dramaticFunction: z.enum(["hook", "setup", "escalation", "climax", "resolution", "bridge"]),
  estimatedDurationSeconds: z.number().positive(),
  dialogueDensity: z.enum(["low", "medium", "high"]),
  actionDensity: z.enum(["low", "medium", "high"]),
  beats: z.array(BeatSchema).min(1).max(10),
});

const CharacterSchema = z.object({
  name: z.string(),
  role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
  estimatedSpeakingLines: z.number().int().min(0),
  emotionalRange: z.enum(["low", "medium", "high"]),
  scenesAppearingIn: z.array(z.number().int().positive()),
});

const RuntimeOptionSchema = z.object({
  estimatedMinutes: z.number().positive(),
  tradeoffs: z.string(),
});

const AnalysisResponseSchema = z.object({
  title: z.string(),
  logline: z.string(),
  totalScenes: z.number().int().positive(),
  estimatedWordCount: z.number().int().positive(),
  narrativeComplexityScore: z.number().int().min(1).max(10),
  complexityReasoning: z.string(),
  runtimeRecommendation: z.object({
    suggested: z.enum(["Short", "Medium", "Long"]),
    reasoning: z.string(),
    short: RuntimeOptionSchema,
    medium: RuntimeOptionSchema,
    long: RuntimeOptionSchema,
  }),
  characters: z.array(CharacterSchema),
  scenes: z.array(SceneSchema).min(1),
  productionNotes: z.string(),
  contentWarnings: z.array(z.string()),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { projectName, scriptText, genre, tone, platform, targetLength } = parsed.data;

  // 2. Resolve API key (DB-stored takes priority, env var is fallback)
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      {
        data: null,
        error:
          "Anthropic API key not configured. Go to Settings → AI Providers to add your key.",
      },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // 3. Call Claude
  let rawAnalysis: string;
  let claudeInputTokens = 0;
  let claudeOutputTokens = 0;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SCRIPT_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildScriptAnalysisPrompt(scriptText, {
            platform,
            targetLength,
            genre,
            tone,
          }),
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Claude");
    rawAnalysis = block.text;
    claudeInputTokens = message.usage.input_tokens;
    claudeOutputTokens = message.usage.output_tokens;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze] Claude API error:", msg);

    if (msg.toLowerCase().includes("rate limit") || msg.includes("529") || msg.includes("429")) {
      return NextResponse.json(
        { data: null, error: "Too many requests — please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { data: null, error: `Claude API error: ${msg}` },
      { status: 502 }
    );
  }

  // 4. Parse and validate Claude's JSON response
  let analysis: ScriptAnalysis;
  try {
    const cleaned = rawAnalysis
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    const json = JSON.parse(cleaned);
    const result = AnalysisResponseSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`Schema mismatch: ${result.error.errors[0].message}`);
    }
    analysis = result.data as ScriptAnalysis;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze] Failed to parse Claude response:", msg, "\nRaw:", rawAnalysis);
    return NextResponse.json(
      {
        data: null,
        error:
          "Analysis failed — the AI returned an unexpected response. Please try again.",
      },
      { status: 502 }
    );
  }

  // 5. Persist to database
  try {
    // Create project + script first so we have the projectId
    const project = await db.project.create({
      data: {
        name: projectName,
        status: "DRAFT",
        genre,
        tone,
        targetLength: targetLength === "ai-recommend" ? analysis.runtimeRecommendation.suggested.toLowerCase() : targetLength,
        scripts: {
          create: {
            content: scriptText,
            parsedData: analysis as object,
          },
        },
      },
    });

    // Create Scene records with predictable IDs (matching the generate route's upsert key)
    await Promise.all(
      analysis.scenes.map((scene) =>
        db.scene.create({
          data: {
            id: `${project.id}-scene-${scene.sceneNumber}`,
            projectId: project.id,
            sceneNumber: scene.sceneNumber,
            title: scene.title,
            location: scene.location ?? null,
            timeOfDay: scene.timeOfDay,
            status: "DRAFT",
          },
        })
      )
    );

    // Fire-and-forget cost recording now that we have the projectId
    if (claudeInputTokens > 0) {
      void recordAnthropicCost(project.id, "script_analysis", claudeInputTokens, claudeOutputTokens);
    }

    return NextResponse.json(
      { data: { projectId: project.id, analysis }, error: null },
      { status: 201 }
    );
  } catch (err) {
    console.error("[analyze] Database error:", err);
    return NextResponse.json(
      { data: null, error: "Failed to save project. Is your database running?" },
      { status: 500 }
    );
  }
}
