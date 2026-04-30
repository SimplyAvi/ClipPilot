// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScriptBeat {
  beatNumber: number;
  description: string;
  emotionalShift: string;
  suggestedShotType: "wide" | "medium" | "close-up" | "insert" | "reaction" | "over-shoulder";
  estimatedDurationSeconds: number;
}

export interface ScriptScene {
  sceneNumber: number;
  title: string;
  location: string;
  timeOfDay: "day" | "night" | "dawn" | "dusk" | "interior";
  charactersPresent: string[];
  emotionalTone: string;
  dramaticFunction: "hook" | "setup" | "escalation" | "climax" | "resolution" | "bridge";
  estimatedDurationSeconds: number;
  dialogueDensity: "low" | "medium" | "high";
  actionDensity: "low" | "medium" | "high";
  beats: ScriptBeat[];
}

export interface ScriptCharacter {
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  estimatedSpeakingLines: number;
  emotionalRange: "low" | "medium" | "high";
  scenesAppearingIn: number[];
}

export interface RuntimeOption {
  estimatedMinutes: number;
  tradeoffs: string;
}

export interface ScriptAnalysis {
  title: string;
  logline: string;
  totalScenes: number;
  estimatedWordCount: number;
  narrativeComplexityScore: number;
  complexityReasoning: string;
  runtimeRecommendation: {
    suggested: "Short" | "Medium" | "Long";
    reasoning: string;
    short: RuntimeOption;
    medium: RuntimeOption;
    long: RuntimeOption;
  };
  characters: ScriptCharacter[];
  scenes: ScriptScene[];
  productionNotes: string;
  contentWarnings: string[];
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

export const SCRIPT_ANALYSIS_SYSTEM_PROMPT = `You are a professional script analyst and film producer. Your job is to analyze a script and break it down into a structured production plan for a short-form social media video.

Analyze the provided script and return a JSON object with this exact structure:

{
  "title": "suggested title for the video",
  "logline": "one sentence description",
  "totalScenes": number,
  "estimatedWordCount": number,
  "narrativeComplexityScore": number from 1-10,
  "complexityReasoning": "brief explanation of the score",
  "runtimeRecommendation": {
    "suggested": "Short" | "Medium" | "Long",
    "reasoning": "why this runtime fits the script",
    "short": { "estimatedMinutes": number, "tradeoffs": "what gets cut" },
    "medium": { "estimatedMinutes": number, "tradeoffs": "balanced approach" },
    "long": { "estimatedMinutes": number, "tradeoffs": "what extra room allows" }
  },
  "characters": [
    {
      "name": "character name",
      "role": "protagonist | antagonist | supporting | minor",
      "estimatedSpeakingLines": number,
      "emotionalRange": "low | medium | high",
      "scenesAppearingIn": [scene numbers as integers]
    }
  ],
  "scenes": [
    {
      "sceneNumber": number,
      "title": "short descriptive title",
      "location": "location name",
      "timeOfDay": "day | night | dawn | dusk | interior",
      "charactersPresent": ["character names"],
      "emotionalTone": "one word",
      "dramaticFunction": "hook | setup | escalation | climax | resolution | bridge",
      "estimatedDurationSeconds": number,
      "dialogueDensity": "low | medium | high",
      "actionDensity": "low | medium | high",
      "beats": [
        {
          "beatNumber": number,
          "description": "what happens in this beat",
          "emotionalShift": "what emotion changes or intensifies",
          "suggestedShotType": "wide | medium | close-up | insert | reaction | over-shoulder",
          "estimatedDurationSeconds": number
        }
      ]
    }
  ],
  "productionNotes": "any special considerations for generation",
  "contentWarnings": ["list any sensitive content categories present"]
}

Return ONLY valid JSON. No markdown code blocks. No explanation outside the JSON object.`;

// ─── Prompt builder ────────────────────────────────────────────────────────────

export interface ScriptAnalysisContext {
  platform: string;
  targetLength: string; // "short" | "medium" | "long" | "ai-recommend"
  genre: string;
  tone: string;
  productionMode?: string;
  theme?: {
    genre?: string | null;
    tone?: string | null;
    pacing?: string | null;
    environmentDescription?: string | null;
    cinematographyNotes?: string | null;
  } | null;
}

export function buildScriptAnalysisPrompt(
  scriptText: string,
  ctx: ScriptAnalysisContext
): string {
  const lengthGuide =
    ctx.targetLength === "ai-recommend"
      ? "Let AI recommend the best runtime based on the script."
      : `Target runtime preference: ${ctx.targetLength} (Short ≈ 30 s, Medium ≈ 60 s, Long ≈ 90 s).`;

  return `Analyze the following script.

CONTEXT:
- Target Platform: ${ctx.platform}
- ${lengthGuide}
- Genre: ${ctx.genre}
- Tone: ${ctx.tone}
${ctx.productionMode ? `- Production Mode: ${ctx.productionMode}` : ""}
${ctx.theme ? `
THEME CONTEXT:
This script will be produced in the style of this theme:
- Genre: ${ctx.theme.genre ?? "unspecified"}
- Tone: ${ctx.theme.tone ?? "unspecified"}
- Pacing feel: ${ctx.theme.pacing ?? "unspecified"}
- Environment: ${ctx.theme.environmentDescription ?? "unspecified"}
- Cinematography approach: ${ctx.theme.cinematographyNotes ?? "unspecified"}

Let this inform your scene pacing estimates, shot type suggestions, visual scene choices, and runtime recommendation.
` : ""}

SCRIPT:
---
${scriptText}
---

Return the JSON analysis now.`;
}
