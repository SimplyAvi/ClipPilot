import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";
import { buildCharacterFromThemePrompt } from "@/lib/characters/theme-character-prompt";
import {
  GeneratedCharacterSchema,
  extractJsonObject,
  missingGeneratedCharacterFields,
} from "@/lib/characters/generated-character";

const RequestSchema = z.object({
  themeId: z.string().min(1),
  gender: z.enum(["man", "woman"]),
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

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { data: null, error: "Anthropic API key not configured. Add Claude in Settings -> AI Providers." },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildCharacterFromThemePrompt(theme, parsed.data.gender);

  async function callClaude(extraInstruction = "") {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 5000,
      system: "Return valid raw JSON only. Do not include markdown fences, commentary, or explanations.",
      messages: [{ role: "user", content: `${prompt}\n\n${extraInstruction}`.trim() }],
    });
    const block = message.content[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response type from Claude");
    return block.text;
  }

  let raw = "";
  let json: unknown;
  try {
    raw = await callClaude();
    json = extractJsonObject(raw);
  } catch {
    try {
      raw = await callClaude("Your previous response was invalid. Return ONLY one raw JSON object with no markdown.");
      json = extractJsonObject(raw);
    } catch (err) {
      console.error("[generate-from-theme] invalid JSON", err, raw);
      return NextResponse.json(
        { data: null, error: "Claude returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }
  }

  const result = GeneratedCharacterSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json({
      data: {
        tempId: crypto.randomUUID(),
        themeId: theme.id,
        themeName: theme.name,
        gender: parsed.data.gender,
        character: json,
        missingFields: missingGeneratedCharacterFields(json),
      },
      error: "Generated character is missing required fields. Review and fill the highlighted fields manually.",
    }, { status: 206 });
  }

  return NextResponse.json({
    data: {
      tempId: crypto.randomUUID(),
      themeId: theme.id,
      themeName: theme.name,
      gender: parsed.data.gender,
      character: result.data,
      missingFields: [],
    },
    error: null,
  });
}
