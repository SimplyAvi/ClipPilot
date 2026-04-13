/**
 * POST /api/scripts/expand-script
 *
 * Calls Claude with the logline + beats and streams the full script
 * back as a text/plain Server-Sent Events stream.
 *
 * Client reads chunks via EventSource or fetch ReadableStream.
 * Each SSE event has the shape: data: <text chunk>\n\n
 * A final event signals completion: data: [DONE]\n\n
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import {
  SCRIPT_EXPANSION_SYSTEM_PROMPT,
  buildScriptExpansionPrompt,
} from "@/lib/prompts/script-expansion";

const BeatSchema = z.object({
  beatNumber: z.number().int().positive(),
  label: z.string(),
  description: z.string(),
  estimatedDurationSec: z.number().int().positive(),
});

const RequestSchema = z.object({
  logline: z.string().min(5).max(500),
  beats: z.array(BeatSchema).min(1).max(10),
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
    return new Response(
      `data: {"error":"Invalid JSON body"}\n\ndata: [DONE]\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message;
    return new Response(
      `data: {"error":"${msg}"}\n\ndata: [DONE]\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      `data: {"error":"ANTHROPIC_API_KEY not configured"}\n\ndata: [DONE]\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(chunk: string) {
        // Escape newlines within the SSE data value
        const escaped = chunk.replace(/\n/g, "\\n");
        controller.enqueue(enc.encode(`data: ${escaped}\n\n`));
      }

      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SCRIPT_EXPANSION_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildScriptExpansionPrompt(parsed.data),
            },
          ],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(event.delta.text);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[expand-script] stream error:", msg);
        send(JSON.stringify({ error: msg }));
      } finally {
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
