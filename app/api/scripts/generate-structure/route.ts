/**
 * POST /api/scripts/generate-structure
 *
 * Calls Claude with a logline and returns a 3 or 5-beat story structure as JSON.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import {
  STRUCTURE_SYSTEM_PROMPT,
  buildStructurePrompt,
  type Beat,
} from "@/lib/prompts/structure";

const RequestSchema = z.object({
  logline: z.string().min(5).max(500),
  genre: z.string().min(1),
  tone: z.string().min(1),
  platform: z.string().min(1),
  targetDurationSec: z.number().int().min(15).max(600),
});

const BeatSchema = z.object({
  beatNumber: z.number().int().positive(),
  label: z.string().min(1),
  description: z.string().min(5),
  estimatedDurationSec: z.number().int().positive(),
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
    return NextResponse.json(
      { data: null, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { data: null, error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: STRUCTURE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildStructurePrompt(parsed.data) }],
    });

    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Claude");

    // Strip markdown fences if present
    const cleaned = block.text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    const rawBeats = JSON.parse(cleaned);
    const beats: Beat[] = z.array(BeatSchema).parse(rawBeats);

    return NextResponse.json({ data: { beats }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-structure]", msg);
    return NextResponse.json({ data: null, error: `Structure generation failed: ${msg}` }, { status: 502 });
  }
}
