import { z } from "zod";

const FlexibleString = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return Object.values(item).join(" - ");
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") return Object.values(value).join(" - ");
  return value;
}, z.string().min(1));

export const GeneratedCharacterSchema = z.object({
  nameOptions: z.array(z.object({
    name: FlexibleString,
    meaningOrOrigin: FlexibleString,
  })).min(1),
  suggestedEthnicity: FlexibleString,
  heritage: FlexibleString,
  age: z.number().int().min(19).max(55),
  physicalDescription: FlexibleString,
  distinctiveFeature: FlexibleString,
  defaultWardrobe: FlexibleString,
  biography: FlexibleString,
  personality: FlexibleString,
  motivations: FlexibleString,
  fears: FlexibleString,
  quirks: FlexibleString,
  emotionalRange: z.enum(["low", "medium", "high"]),
  gestureTendencies: FlexibleString,
  forbiddenChanges: FlexibleString,
  voiceProfile: z.object({
    toneDescription: FlexibleString,
    pitch: FlexibleString,
    pace: FlexibleString,
    accent: FlexibleString,
    accentStrength: FlexibleString,
    emotionalDelivery: FlexibleString,
    speechPatterns: FlexibleString,
    elevenLabsSearchTerms: FlexibleString,
    voiceReferenceNote: FlexibleString,
  }),
  portraitPrompt: FlexibleString,
  role: z.enum(["protagonist", "supporting", "antagonist", "narrator"]),
  suggestedTags: z.preprocess((value) => {
    if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    return value;
  }, z.array(FlexibleString).min(1)),
  castingNote: FlexibleString,
});

export type GeneratedCharacter = z.infer<typeof GeneratedCharacterSchema>;

export const GENERATED_CHARACTER_REQUIRED_FIELDS = Object.keys(
  GeneratedCharacterSchema.shape
);

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function missingGeneratedCharacterFields(value: unknown): string[] {
  const parsed = GeneratedCharacterSchema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
}
