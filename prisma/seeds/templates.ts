/**
 * prisma/seeds/templates.ts
 *
 * Seeds 6 built-in starter templates.
 * Called from prisma/seed.ts as part of `npx prisma db seed`.
 */

import type { PrismaClient } from "@prisma/client";

export const BUILT_IN_TEMPLATES = [
  {
    id: "tmpl-60s-thriller",
    name: "60-Second Thriller Short",
    description:
      "High tension, slow reveals, restrained dialogue. Best for mystery and crime content.",
    genre: "thriller",
    tone: "tense",
    visualStyle: "noir-cinematic",
    audioStyle: "minimal-suspense",
    targetPlatform: "youtube-shorts",
    targetLength: "medium",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "noir",
      lightingStyle: "low-key",
      pacing: "slow-reveals",
      transitionStyle: "hard-cut",
    }),
  },
  {
    id: "tmpl-30s-emotional-hook",
    name: "30-Second Emotional Hook",
    description:
      "Opens with a powerful emotional moment. Designed for maximum emotional impact in 30 seconds.",
    genre: "drama",
    tone: "intimate",
    visualStyle: "stylized-realism",
    audioStyle: "sparse-piano",
    targetPlatform: "tiktok",
    targetLength: "short",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "warm",
      lightingStyle: "soft-natural",
      pacing: "intimate-close-ups",
      transitionStyle: "dissolve",
    }),
  },
  {
    id: "tmpl-90s-character-story",
    name: "90-Second Character Story",
    description:
      "A character faces a challenge and transforms. Classic three-act structure in 90 seconds.",
    genre: "drama",
    tone: "hopeful",
    visualStyle: "live-action-cinematic",
    audioStyle: "orchestral-swell",
    targetPlatform: "instagram-reels",
    targetLength: "long",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "warm-cinematic",
      lightingStyle: "golden-hour",
      pacing: "three-act",
      transitionStyle: "dissolve",
    }),
  },
  {
    id: "tmpl-60s-documentary",
    name: "60-Second Documentary Style",
    description:
      "Observational, natural feel. Works well for real-world topics and educational content.",
    genre: "documentary",
    tone: "restrained",
    visualStyle: "documentary-real",
    audioStyle: "documentary-natural",
    targetPlatform: "youtube-shorts",
    targetLength: "medium",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "natural",
      lightingStyle: "available-light",
      pacing: "observational",
      transitionStyle: "hard-cut",
    }),
  },
  {
    id: "tmpl-30s-horror-micro",
    name: "30-Second Horror Micro",
    description:
      "Maximum dread in minimum time. Designed around one scare and a twist.",
    genre: "horror",
    tone: "dark",
    visualStyle: "high-contrast-noir",
    audioStyle: "silence-heavy-dramatic",
    targetPlatform: "tiktok",
    targetLength: "short",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "desaturated-cold",
      lightingStyle: "high-contrast",
      pacing: "slow-build-shock",
      transitionStyle: "hard-cut",
    }),
  },
  {
    id: "tmpl-60s-scifi-concept",
    name: "60-Second Sci-Fi Concept",
    description:
      "Builds a world and stakes quickly. Best for concept films and speculative fiction.",
    genre: "sci-fi",
    tone: "epic",
    visualStyle: "futuristic-cinematic",
    audioStyle: "electronic-ambient",
    targetPlatform: "youtube-shorts",
    targetLength: "medium",
    isBuiltIn: true,
    generationConfig: JSON.stringify({
      colorGrade: "cool-futuristic",
      lightingStyle: "dramatic-rim",
      pacing: "world-build-escalate",
      transitionStyle: "dissolve",
    }),
  },
];

export async function seedTemplates(db: PrismaClient) {
  console.log("Seeding built-in templates…");

  for (const tmpl of BUILT_IN_TEMPLATES) {
    await db.template.upsert({
      where: { id: tmpl.id },
      update: {
        name: tmpl.name,
        description: tmpl.description,
        genre: tmpl.genre,
        tone: tmpl.tone,
        visualStyle: tmpl.visualStyle,
        audioStyle: tmpl.audioStyle,
        targetPlatform: tmpl.targetPlatform,
        targetLength: tmpl.targetLength,
        isBuiltIn: tmpl.isBuiltIn,
        generationConfig: tmpl.generationConfig,
      },
      create: tmpl,
    });
    console.log(`  ✓ ${tmpl.name}`);
  }

  console.log(`\nSeeded ${BUILT_IN_TEMPLATES.length} built-in templates.`);
}
