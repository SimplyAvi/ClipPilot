import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/app-settings";

const BodySchema = z.object({ segmentId: z.string().min(1) });

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

  const segment = await db.visualSegment.findUnique({
    where: { id: parsed.data.segmentId },
    include: { project: { include: { theme: true } } },
  });
  if (!segment) return NextResponse.json({ data: null, error: "Segment not found" }, { status: 404 });

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) return NextResponse.json({ data: null, error: "Anthropic API key not configured" }, { status: 503 });

  const prompt = `The following poem stanza has this visual concept assigned to it. Generate 3 DIFFERENT visual approaches for the same stanza. Each should feel distinct - different primary subjects, different emotional angles, but all fitting the words.

Stanza: ${segment.stanzaText}
Current concept: ${segment.visualConcept}
Theme: ${segment.project.theme?.description ?? segment.project.theme?.name ?? "No specific theme"}

Return ONLY valid JSON:
{
  "alternatives": [
    {
      "visualConcept": "detailed concept with no people, no faces, no human figures",
      "primarySubject": "main visual element",
      "movementStyle": "Static | Slow Drift | Gentle Float | Dynamic Flow | Rapid Cut",
      "cameraApproach": "Extreme Wide | Wide | Medium | Close Detail | Abstract Motion",
      "colorTemperature": "Warm | Cool | Neutral | Shifting",
      "emotionalQuality": "viewer feeling",
      "visualPromptBase": "40-word prompt, no people, no faces"
    }
  ]
}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected Claude response");
    const cleaned = block.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const json = JSON.parse(cleaned) as { alternatives?: unknown[] };
    return NextResponse.json({ data: { alternatives: json.alternatives ?? [] }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate alternatives";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
