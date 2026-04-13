/**
 * POST /api/scripts/generate-logline
 *
 * Calls Claude with a raw idea and returns a polished one-sentence logline.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { LOGLINE_SYSTEM_PROMPT, buildLoglinePrompt } from "@/lib/prompts/logline";

const RequestSchema = z.object({
  rawIdea: z.string().min(5, "Idea must be at least 5 characters").max(1000),
  genre: z.string().min(1),
  tone: z.string().min(1),
  platform: z.string().min(1),
  targetDurationSec: z.number().int().min(15).max(600),
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
      max_tokens: 256,
      system: LOGLINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildLoglinePrompt(parsed.data) }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const logline = block.text.trim().replace(/^["']|["']$/g, ""); // strip surrounding quotes if any
    return NextResponse.json({ data: { logline }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-logline]", msg);
    return NextResponse.json({ data: null, error: `Claude API error: ${msg}` }, { status: 502 });
  }
}
