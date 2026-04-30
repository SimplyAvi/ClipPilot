import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";
import { summarizeTheme } from "@/lib/characters/theme-character-prompt";
import { extractJsonObject } from "@/lib/characters/generated-character";

const RequestSchema = z.object({
  field: z.enum(["biography", "personality", "voice"]),
  currentCharacterData: z.record(z.unknown()),
  themeId: z.string().min(1),
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
  if (!theme) return NextResponse.json({ data: null, error: "Theme not found" }, { status: 404 });

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json({ data: null, error: "Anthropic API key not configured." }, { status: 503 });
  }

  const fieldInstruction = parsed.data.field === "personality"
    ? "personality, motivations, fears, quirks, gestureTendencies, and emotionalRange"
    : parsed.data.field === "voice"
      ? "voiceProfile"
      : "biography";

  const prompt = `
Given this character profile:
${JSON.stringify(parsed.data.currentCharacterData, null, 2)}

And this theme:
${summarizeTheme(theme)}

Regenerate ONLY the ${fieldInstruction} for this character.
Keep the same gender, age, ethnicity, physical identity, and thematic fit.
Return ONLY raw JSON for that field group, nothing else.
`.trim();

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2200,
      system: "Return raw JSON only. No markdown.",
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response type from Claude");
    const json = extractJsonObject(block.text);
    return NextResponse.json({ data: json, error: null });
  } catch (err) {
    console.error("[regenerate-field]", err);
    return NextResponse.json({ data: null, error: "Could not regenerate this field" }, { status: 502 });
  }
}
