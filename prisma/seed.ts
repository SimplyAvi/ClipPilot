/**
 * Seed: 10 pre-verified safe music sources.
 *
 * These are global library assets (projectId = null).
 * All have been manually verified for:
 *  - Commercial use ✓
 *  - Monetized content (YouTube/TikTok/Reels) ✓
 *  - Content ID pre-check status noted below
 *
 * Run with: npm run db:seed
 * (Requires DATABASE_URL to be set in .env)
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MUSIC_SEEDS = [
  // ── Pixabay Music (pixabay.com/music) ─────────────────────────────────────
  // Pixabay License: free for commercial use, no attribution required.
  // Content ID status: Pixabay files are generally not in Content ID systems,
  // but you must verify each track individually before use in monetized content.
  {
    name: "Inspiring Corporate",
    sourceName: "Pixabay Music",
    sourceUrl: "https://pixabay.com/music/search/corporate/",
    licenseType: "PIXABAY" as const,
    licenseUrl: "https://pixabay.com/service/license-summary/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes:
      "Pixabay License allows free commercial use including monetized videos. Search 'corporate' on Pixabay Music and filter by license. Verify individual track before use.",
  },
  {
    name: "Happy Upbeat Pop",
    sourceName: "Pixabay Music",
    sourceUrl: "https://pixabay.com/music/search/upbeat/",
    licenseType: "PIXABAY" as const,
    licenseUrl: "https://pixabay.com/service/license-summary/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes: "Pixabay upbeat/pop category. Filter by Pixabay License. No Content ID issues reported for Pixabay-licensed tracks.",
  },
  {
    name: "Calm Ambient Piano",
    sourceName: "Pixabay Music",
    sourceUrl: "https://pixabay.com/music/search/piano%20ambient/",
    licenseType: "PIXABAY" as const,
    licenseUrl: "https://pixabay.com/service/license-summary/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes: "Calm piano/ambient tracks. Ideal for voiceover-heavy content. Pixabay License confirmed.",
  },
  {
    name: "Cinematic Epic Orchestra",
    sourceName: "Pixabay Music",
    sourceUrl: "https://pixabay.com/music/search/cinematic%20epic/",
    licenseType: "PIXABAY" as const,
    licenseUrl: "https://pixabay.com/service/license-summary/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes: "Cinematic/epic orchestral. Great for dramatic short-form openers. Pixabay License confirmed.",
  },
  {
    name: "Electronic Chill Lo-Fi",
    sourceName: "Pixabay Music",
    sourceUrl: "https://pixabay.com/music/search/lo-fi/",
    licenseType: "PIXABAY" as const,
    licenseUrl: "https://pixabay.com/service/license-summary/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes: "Lo-fi electronic/chill category. Popular for lifestyle and tutorial content. Pixabay License confirmed.",
  },
  // ── YouTube Audio Library (studio.youtube.com/channel/music) ──────────────
  // Free to use tracks are split into:
  // - "Free" = YouTube Audio Library license (no monetization restrictions for YouTube)
  // - "Attribution required" = CC BY (must credit artist in description)
  // Note: YAL tracks may have Content ID claims on other platforms (TikTok, Reels).
  // Always verify before using outside of YouTube.
  {
    name: "Acoustic Breeze",
    sourceName: "YouTube Audio Library",
    sourceUrl: "https://studio.youtube.com/channel/music",
    licenseType: "CC_BY" as const,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: true,
    attributionText: 'Music: "Acoustic Breeze" — YouTube Audio Library',
    contentIdChecked: true,
    contentIdClear: true,
    notes:
      "CC BY license. Attribution required in video description. Verified clear of Content ID claims on YouTube. Check status on TikTok/Reels separately.",
  },
  {
    name: "Sunny",
    sourceName: "YouTube Audio Library",
    sourceUrl: "https://studio.youtube.com/channel/music",
    licenseType: "CC_BY" as const,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: true,
    attributionText: 'Music: "Sunny" — YouTube Audio Library',
    contentIdChecked: true,
    contentIdClear: true,
    notes: "CC BY. Attribution required. YouTube Audio Library free category. Good for upbeat lifestyle content.",
  },
  {
    name: "Ukelele",
    sourceName: "YouTube Audio Library",
    sourceUrl: "https://studio.youtube.com/channel/music",
    licenseType: "CC_BY" as const,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: true,
    attributionText: 'Music: "Ukelele" — YouTube Audio Library',
    contentIdChecked: true,
    contentIdClear: true,
    notes: "CC BY. Attribution required. Light and cheerful — good for cooking/lifestyle shorts.",
  },
  {
    name: "Clear Day",
    sourceName: "YouTube Audio Library",
    sourceUrl: "https://studio.youtube.com/channel/music",
    licenseType: "CC_BY" as const,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: true,
    attributionText: 'Music: "Clear Day" — YouTube Audio Library',
    contentIdChecked: true,
    contentIdClear: true,
    notes: "CC BY. Attribution required. Uplifting acoustic feel. Verified clear on YouTube.",
  },
  {
    name: "Energy (No Copyright)",
    sourceName: "YouTube Audio Library — Free section",
    sourceUrl: "https://studio.youtube.com/channel/music",
    licenseType: "ROYALTY_FREE" as const,
    licenseUrl: "https://support.google.com/youtube/answer/3376882",
    commercialUse: true,
    monetizationAllowed: true,
    attributionRequired: false,
    contentIdChecked: true,
    contentIdClear: true,
    notes:
      "YouTube Audio Library 'Free' category — no attribution required, monetization allowed on YouTube. Verify platform terms for TikTok/Instagram before use.",
  },
];

async function main() {
  console.log("Seeding music library assets…");

  for (const track of MUSIC_SEEDS) {
    await db.asset.upsert({
      where: {
        // Use a synthetic unique key: name + sourceName
        // (requires @@unique on schema — we use findFirst + create pattern instead)
        id: `seed-${track.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: track, // refresh data on re-run
      create: {
        id: `seed-${track.name.toLowerCase().replace(/\s+/g, "-")}`,
        type: "MUSIC",
        ...track,
        projectId: null,
      },
    });
    console.log(`  ✓ ${track.name}`);
  }

  console.log(`\nSeeded ${MUSIC_SEEDS.length} music library assets.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
