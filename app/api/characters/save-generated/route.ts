import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";
import { GeneratedCharacterSchema } from "@/lib/characters/generated-character";
import { appendGenerationLog } from "@/lib/storage/generation-log";

const RequestSchema = z.object({
  themeId: z.string().min(1),
  gender: z.enum(["man", "woman"]),
  selectedName: z.string().min(1).max(100),
  selectedPortraitPath: z.preprocess((value) => Array.isArray(value) ? value[0] : value, z.string().min(1).nullable().optional()),
  selectedVoiceId: z.string().optional().nullable(),
  character: GeneratedCharacterSchema,
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

  const theme = await db.theme.findUnique({
    where: { id: parsed.data.themeId },
    include: { projectsUsingTheme: { select: { projectSlug: true, name: true }, take: 1 } },
  });
  if (!theme) {
    return NextResponse.json({ data: null, error: "Theme not found" }, { status: 404 });
  }

  const characterSlug = slugify(parsed.data.selectedName);
  const biblePath = `themes/${theme.id}/characters/char_${characterSlug}/character_bible.json`;

  try {
    let portraitPath: string | null = null;
    if (parsed.data.selectedPortraitPath) {
      const permanentPortraitPath = `themes/${theme.id}/characters/char_${characterSlug}/portrait_approved.png`;
      const portraitBuffer = await storage.read(parsed.data.selectedPortraitPath);
      const storedPortrait = await storage.save(permanentPortraitPath, portraitBuffer, "image/png", {
        themeId: theme.id,
        generatedCharacter: "true",
        approved: "true",
      });
      portraitPath = storedPortrait.path;
    }

    const c = parsed.data.character;
    const character = await db.character.create({
      data: {
        name: parsed.data.selectedName,
        role: normalizeRole(c.role),
        age: c.age,
        gender: parsed.data.gender === "man" ? "Man" : "Woman",
        ethnicity: [c.suggestedEthnicity, c.heritage].filter(Boolean).join(" - "),
        physicalDescription: [c.physicalDescription, `Wardrobe: ${c.defaultWardrobe}`, `Distinctive feature: ${c.distinctiveFeature}`].join("\n\n"),
        biography: c.biography,
        personality: c.personality,
        motivations: c.motivations,
        fears: c.fears,
        quirks: c.quirks,
        emotionalRange: c.emotionalRange,
        gestureTendencies: c.gestureTendencies,
        forbiddenChanges: c.forbiddenChanges,
        portraitPath,
        portraitPrompt: c.portraitPrompt,
        portraitStyle: "theme-locked",
        voiceId: parsed.data.selectedVoiceId ?? null,
        voicePace: c.voiceProfile.pace,
        voiceAccent: c.voiceProfile.accent,
        voiceTone: c.voiceProfile.toneDescription,
        voiceNotes: [
          c.voiceProfile.voiceReferenceNote,
          `Pitch: ${c.voiceProfile.pitch}`,
          `Accent strength: ${c.voiceProfile.accentStrength}`,
          `Delivery: ${c.voiceProfile.emotionalDelivery}`,
          `Speech patterns: ${c.voiceProfile.speechPatterns}`,
        ].join("\n"),
        tags: c.suggestedTags.join(", "),
        generatedFromThemeId: theme.id,
      },
    });

    await storage.save(biblePath, Buffer.from(JSON.stringify({
      themeId: theme.id,
      themeName: theme.name,
      characterId: character.id,
      selectedName: parsed.data.selectedName,
      selectedPortraitPath: portraitPath,
      selectedVoiceId: parsed.data.selectedVoiceId ?? null,
      generatedProfile: c,
      savedAt: new Date().toISOString(),
    }, null, 2)), "application/json", {
      themeId: theme.id,
      characterId: character.id,
      type: "character-bible",
    });

    const projectSlug = theme.projectsUsingTheme[0]?.projectSlug ?? slugify(theme.name);
    await appendGenerationLog(projectSlug, {
      timestamp: new Date().toISOString(),
      type: "character_generated",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      themeId: theme.id,
      themeName: theme.name,
      gender: parsed.data.gender,
      characterId: character.id,
      characterName: parsed.data.selectedName,
      portraitProvider: "replicate",
      outputPath: biblePath,
      cost: 0.02,
      status: "success",
    }).catch(() => undefined);

    return NextResponse.json({
      data: { characterId: character.id, redirectUrl: `/characters/${character.id}` },
      error: null,
    }, { status: 201 });
  } catch (err) {
    console.error("[save-generated]", err);
    return NextResponse.json({ data: null, error: "Could not save generated character" }, { status: 500 });
  }
}

function normalizeRole(role: string) {
  const map: Record<string, string> = {
    protagonist: "Protagonist",
    supporting: "Supporting",
    antagonist: "Antagonist",
    narrator: "Narrator",
  };
  return map[role] ?? role;
}
