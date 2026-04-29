/**
 * lib/prompts/theme-analysis.ts
 *
 * System prompt and JSON schema for Claude vision-based theme analysis.
 * Sent along with extracted video frames to get a structured style profile.
 */

export const THEME_ANALYSIS_SYSTEM_PROMPT = `You are a professional film and video analyst specializing in visual style, cinematography, and production aesthetics.

You will be shown a series of frames from a video. Your job is to analyze the complete visual and production style of this video and return a detailed structured theme profile that can be used to recreate this style in new AI-generated videos.

Analyze every visible element:
- Cinematography: shot types, camera angles, movement, framing
- Lighting: quality, direction, color temperature, drama
- Color grade: overall palette, contrast, saturation treatment
- Pacing feel: based on the frames, is this fast-cut or slow?
- Setting and environment: where does this take place?
- Character aesthetics: age, clothing style, presence if visible
- Genre and tone: what kind of story is this telling?
- Production level: indie/cinematic/documentary/commercial
- Mood: what does the viewer feel watching this?

Return ONLY a valid JSON object with no additional commentary.`;

export function buildThemeAnalysisPrompt(
  colorHexList: string[],
  temperature: string,
  saturation: string,
  contrast: string
): string {
  return `Color palette context provided:
Dominant colors: ${colorHexList.join(", ")}
Temperature: ${temperature}
Saturation: ${saturation}
Contrast: ${contrast}

Return ONLY a valid JSON object with this exact structure:
{
  "suggestedThemeName": "a creative 2-4 word name for this style",
  "description": "2-3 sentence description of the overall style",
  "genre": "one of: Thriller|Drama|Romance|Horror|Action|Comedy|Fantasy|Sci-Fi|Mystery|Documentary|Anime|Other",
  "tone": "one of: Dark|Hopeful|Tragic|Intimate|Epic|Suspenseful|Restrained|Playful|Tense",
  "visualStyle": "one of: Live-Action Cinematic|Stylized Realism|Anime|Painterly|Noir|Retro|Futuristic|Fantasy Epic|Documentary-Real",
  "audioStyle": "one of: Orchestral|Ambient|Minimal|Romantic Piano|Electronic|Dark Suspense|Silence-Heavy Dramatic|Documentary-Natural",
  "lightingStyle": "description of lighting approach in 1 sentence",
  "cameraMovement": "one of: Static|Handheld|Smooth Gimbal|Dynamic/Fast|Mixed",
  "dominantShotTypes": ["array of up to 3 from: Wide, Medium, Close-Up, Insert, Extreme Close-Up"],
  "pacing": "one of: Slow|Medium|Fast|Mixed",
  "estimatedAvgShotSeconds": 4,
  "characterAgeRange": "estimated age range if characters visible, e.g. '25-40' or 'Not visible'",
  "characterAppearance": "description of character aesthetic, clothing, and visual presence",
  "characterMood": "how characters carry themselves emotionally",
  "primaryEnvironment": "one of: Urban Exterior|Urban Interior|Rural/Nature|Suburban|Industrial|Fantasy/Otherworldly|Mixed",
  "timeOfDay": ["array from: Day, Night, Golden Hour, Blue Hour, Dawn, Interior - Controlled"],
  "environmentDescription": "detailed description of the world this video lives in",
  "musicGenre": "description of the type of music that would fit this style",
  "musicMood": "emotional quality of the music",
  "musicTempo": "one of: Slow|Medium|Upbeat|Intense",
  "audioNotes": "any specific notes about sound design, silence use, or audio approach",
  "visualPromptModifier": "a 40-60 word string that can be appended to any AI image/video generation prompt to match this exact visual style. Should describe lighting, color grade, camera style, mood, and cinematographic approach. Do not mention specific titles, brands, or people.",
  "audioPromptModifier": "a 20-30 word string describing the music style for AI music generation",
  "cinematographyNotes": "detailed paragraph about the cinematographic approach of this video"
}`;
}

// ─── Expected shape from Claude ───────────────────────────────────────────────

export interface ThemeAnalysisResponse {
  suggestedThemeName: string;
  description: string;
  genre: string;
  tone: string;
  visualStyle: string;
  audioStyle: string;
  lightingStyle: string;
  cameraMovement: string;
  dominantShotTypes: string[];
  pacing: string;
  estimatedAvgShotSeconds: number;
  characterAgeRange: string;
  characterAppearance: string;
  characterMood: string;
  primaryEnvironment: string;
  timeOfDay: string[];
  environmentDescription: string;
  musicGenre: string;
  musicMood: string;
  musicTempo: string;
  audioNotes: string;
  visualPromptModifier: string;
  audioPromptModifier: string;
  cinematographyNotes: string;
}
