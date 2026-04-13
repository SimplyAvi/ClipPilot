/**
 * Beat structure generation prompt — Phase 8
 *
 * Takes a logline and produces a 3-beat (≤60s) or 5-beat (>60s)
 * story structure optimised for short-form video.
 */

export const STRUCTURE_SYSTEM_PROMPT = `You are a short-form video story structure expert.

Your job is to break a logline into a tight story structure — a sequence of beats that can be visualised as distinct scenes or shots.

RULES:
- Return ONLY a valid JSON array of beat objects. No markdown fences, no commentary.
- For a 30–60 second video: return exactly 3 beats (Hook, Escalation, Payoff).
- For a 61–90 second video: return exactly 5 beats (Hook, Build, Midpoint, Escalation, Payoff).
- Each beat must have a clear visual action — something the camera can actually show.
- No internal monologue — only observable behaviour and dialogue cues.
- Characters must be entirely fictional — no real people, celebrities, or public figures.
- No brand names, trademarked products, or real company names.
- Every beat must contribute to the central story arc — no filler.
- Timing should be realistic: Hook = fast (3–8s), middle beats = 8–20s each, Payoff = punchy (5–12s).
- The beat structure must be completable within the target duration.
- Write for social video: the Hook must earn attention in the first 2 seconds.

OUTPUT SCHEMA — return this exact shape, nothing else:
[
  {
    "beatNumber": <integer starting at 1>,
    "label": "<Hook | Build | Midpoint | Escalation | Payoff>",
    "description": "<What visually happens in this beat — 1-2 sentences, action-focused>",
    "estimatedDurationSec": <integer seconds>
  }
]`;

export interface StructurePromptContext {
  logline: string;
  genre: string;
  tone: string;
  platform: string;
  targetDurationSec: number;
}

export function buildStructurePrompt(ctx: StructurePromptContext): string {
  const beatCount = ctx.targetDurationSec <= 60 ? 3 : 5;
  const beatLabels =
    beatCount === 3
      ? "Hook, Escalation, Payoff"
      : "Hook, Build, Midpoint, Escalation, Payoff";

  return `Generate a ${beatCount}-beat story structure for this short-form video.

LOGLINE:
"${ctx.logline}"

CONTEXT:
- Genre: ${ctx.genre}
- Tone: ${ctx.tone}
- Platform: ${ctx.platform}
- Target duration: ${ctx.targetDurationSec} seconds
- Required beats (${beatCount}): ${beatLabels}

Return the JSON beat array now.`;
}

export interface Beat {
  beatNumber: number;
  label: string;
  description: string;
  estimatedDurationSec: number;
}
