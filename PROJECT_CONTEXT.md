# Project: ClipPilot

## What This Is
A personal AI-powered video generation tool for creating social media content
(YouTube Shorts, Instagram Reels, TikTok). I use this to generate short-form
videos from scripts, with AI-generated visuals, voices, and music. I post
these videos in the USA and need all content to be legally compliant.

## Tech Stack
- Frontend: Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- Database: PostgreSQL with Prisma ORM
- Job Queue: BullMQ with Redis
- File Storage: Cloudflare R2
- Package Manager: npm

## AI Provider Integrations
- Video generation: Runway ML (Gen-3 API)
- Voice generation: ElevenLabs (Creator plan)
- Music: Epidemic Sound library (or Pixabay CC0)
- Image generation: Replicate API (SDXL or Flux)
- Script/planning: Anthropic Claude API (claude-sonnet-4-5)

## Legal Compliance Rules
- Every asset used must have a license record before it enters the pipeline
- All music must pass a Content ID fingerprint pre-check before use
- All generated faces must pass a likeness detection check
- Every exported video must have AI disclosure metadata applied
- No real person likenesses, no copyrighted characters, no trademarked logos

## Project Structure
- /app — Next.js app router pages and API routes
  - /api/projects — GET (list) / POST (create) projects
  - /api/scripts/analyze — POST: validate → Claude analysis → save Script + return JSON
  - /api/scripts/extract-text — POST: extract text from uploaded PDF (pdf-parse)
  - /projects/new — New project form (name, genre, tone, platform, duration, script input)
  - /projects/[id] — Project overview page
  - /projects/[id]/analysis — Script analysis results (scene cards, stats, recommendation)
  - /assets — Asset Library: type-filter tabs, color-coded clearance status, all assets
  - /assets/new — Add Asset form: name/type/license/commercialUse/attribution/Content ID check
  - /api/assets — GET (filter by type/projectId) / POST create
  - /api/assets/[id] — PATCH update / DELETE
  - /api/assets/check-content-id — POST: upload audio → AudD API → clear/risk result → optional DB update
  - /settings — Settings page (stub, Phase 4)
- /components — React components
  - /ui — shadcn/ui primitives (button, badge, card, separator)
  - sidebar.tsx — App sidebar with Projects / Assets / Settings nav
  - new-project-dialog.tsx — Modal to create a new project
- /lib — Utility functions and API clients
  - db.ts — Prisma singleton (all DB calls go here)
  - anthropic.ts — Anthropic SDK singleton
  - redis.ts — ioredis singleton + redisConfig for BullMQ
  - queues.ts — BullMQ Queue instances for each job type
  - utils.ts — cn() helper for Tailwind class merging
  - /prompts/script-analysis.ts — Claude prompt + buildScriptAnalysisPrompt()
  - asset-validator.ts — getAssetClearanceStatus() + validateAssets() + areAssetsReadyForGeneration()
- /prisma — Database schema (schema.prisma)
- /workers — BullMQ background job workers
  - script-parse.worker.ts — Script parsing worker (stub, Phase 2)
  - index.ts — Worker process entry point
- /public — Static assets

Phase 7 complete:
- Prisma schema: Export model (ExportPlatform/ExportStatus enums, videoR2Key, pdfR2Key, complianceSnapshot JSON, aiDisclosureApplied, disclosureTimestamp)
- npm: pdfkit + @types/pdfkit installed
- lib/assembler/scene-assembler.ts — assembleScene(): download shots, hard-cut or xfade transitions (dissolve/fade via FFmpeg xfade filter), concat per-shot audio, mux + cinematic color grade (curves filter), upload scene video to R2
- lib/assembler/final-assembler.ts — assembleFinal(): concat scenes, scale to platform res with pad, burn AI disclosure overlay (drawtext, first 3s), burn opening title card (drawtext with alpha fade), H.264 encode at platform spec; getPlatformChecklist() returns platform-specific upload instructions
- lib/compliance/pre-export-checker.ts — runComplianceChecks(): 5 checks: (A) asset commercial use, (B) music Content ID, (C) likeness scan, (D) AI disclosure, (E) duration vs platform limit; returns CheckStatus pass/warn/fail per check + exportAllowed boolean
- lib/provenance/report-generator.ts — generateProvenanceReport(): pdfkit PDF with cover, AI disclosure status, music assets, voice assets, visual generation (provider/model/prompt SHA-256 hash/date/cost), likeness scan results; uploads to R2
- /api/projects/[id]/compliance — GET: runs compliance checks for given platform + durationSec
- /api/projects/[id]/export — GET: list exports; POST: compliance gate → assemble scenes → final assembly → provenance PDF → Export DB record COMPLETE
- /api/projects/[id]/export/[exportId] — GET: export record + signed video + PDF download URLs (2h)
- /projects/[id]/compliance — Compliance page with platform selector, per-check cards (green/yellow/red), overall banner, link to export
- /projects/[id]/compliance/_components/compliance-checker.tsx — client component, auto-reruns on platform change
- /projects/[id]/export — Export page: platform tabs, transition/color-grade options, inline compliance summary, Export button (blocked if compliance fails), download video + PDF buttons, Copy Upload Checklist button, export history
- /projects/[id]/export/_components/export-panel.tsx — client component with full export workflow
- Updated /projects/[id]/page.tsx — added Compliance + Export nav buttons
- .env.example — FFPROBE_PATH added

Phase 6 complete:
- Prisma schema: DialogueLine model, SceneMusicCue model, DialogueStatus enum; Shot audio fields (mixedAudioPath, dialogueStemPath, musicStemPath, lipSyncedVideoPath, lipSyncStatus)
- lib/generators/dialogue.ts — generateSingleLine() + generateShotDialogue(): ElevenLabs TTS per line, timing accumulation, R2 upload, DB status updates
- lib/generators/audio-mix.ts — mixSceneAudio(): FFmpeg dialogue stem (adelay+amix+apad), music stem (volume+afade+apad), full mix; always cleans tmp dir
- lib/generators/lip-sync.ts — lipSyncShot(): Sync Labs v2 API, signed URL generation, async poll (60×5s), R2 upload; returns SKIPPED when key absent
- /api/dialogue — GET (by shotId) + POST create line
- /api/dialogue/[id] — GET + PATCH + DELETE; PATCH resets audio status when text/direction changes
- /api/dialogue/[id]/regenerate — POST ADR: re-generates single line audio, clears shot mix/lip-sync paths so caller knows to re-run
- /api/scenes/[id]/music-cue — GET + PUT (upsert with commercial use validation) + DELETE
- /api/scenes/[id]/audio-mix — POST: runs mixSceneAudio() per shot in scene, updates Shot DB record
- /api/shots/[id]/lip-sync — POST: calls lipSyncShot(), requires generatedVideoPath + mixedAudioPath
- /projects/[id]/music — Music selection page: per-scene cue cards with asset picker, start/fade/volume controls
- /projects/[id]/music/_components/music-selector.tsx — client component
- /projects/[id]/shots/[shotId] — Shot review page: raw + lip-synced video preview, audio pipeline actions, ADR panel, generation prompt
- /projects/[id]/shots/[shotId]/_components/adr-panel.tsx — per-line ADR form (expand/collapse, re-generate single audio line)
- /projects/[id]/shots/[shotId]/_components/audio-actions.tsx — Run Audio Mix + Run Lip Sync buttons with status feedback
- Updated /projects/[id]/page.tsx — added Music nav button
- .env.example — added SYNC_LABS_API_KEY, FFMPEG_PATH note

## Current Status
Phase 1 complete:
- Next.js 14 + TypeScript + Tailwind CSS + App Router
- shadcn/ui component primitives
- Prisma schema: Project, Script, Asset, Job, Scene, Shot
- Home page with New Project dialog and project list
- Sidebar layout (Projects, Assets, Settings)
- BullMQ queues + Redis connection configured
- .env.example with all API key placeholders
- npm run build passes cleanly

Phase 2 complete:
- /projects/new — full form: script textarea + .txt/.pdf/.fountain upload, genre/tone/platform/duration selects
- /api/scripts/analyze — Zod validation → Claude claude-sonnet-4-5 → structured JSON → saved to Script.parsedData
- /api/scripts/extract-text — server-side PDF text extraction (pdf-parse, dynamic import)
- /projects/[id]/analysis — results page: summary stats, runtime recommendation, per-scene cards with beats + shot types
- lib/prompts/script-analysis.ts — editable Claude prompt constant + buildScriptAnalysisPrompt()
- New UI primitives: Input, Textarea, Label, Select

Phase 3 complete:
- Asset Library page (/assets) — type-tab filter, green/yellow/red clearance color coding
- Add Asset form (/assets/new) — full license capture form with tristate yes/no/unknown flags
- Content ID pre-check UI — upload audio file → AudD API → result shown inline
- /api/assets CRUD routes (GET/POST/PATCH/DELETE)
- /api/assets/check-content-id — AudD music fingerprint integration
- lib/asset-validator.ts — clearance status logic + validation report + generation gate
- Prisma schema updated: projectId optional, new enum values (PIXABAY, ELEVENLABS_COMMERCIAL, RUNWAY_COMMERCIAL, UNKNOWN, AI_GENERATED, FOOTAGE), nullable commercialUse/monetizationAllowed
- prisma/seed.ts — 10 pre-verified music sources (5 Pixabay, 5 YouTube Audio Library)
- New UI primitives: Tabs, Checkbox
- AUDD_API_KEY added to .env.example

Phase 4 complete:
- Character model added to Prisma (name, ageAppearance, description, personalityNotes, voice config, confirmedFictional)
- lib/voice-client.ts — ElevenLabs API wrapper with 500ms rate limiting, buildVoiceSettings(), generateVoicePreview()
- /api/elevenlabs/voices — GET voices (5-min ISR cache, sorted premade-first)
- /api/characters — GET (by projectId) + POST create
- /api/characters/[id] — GET + PATCH + DELETE
- /api/characters/preview-voice — POST → streams audio/mpeg for browser playback
- /projects/[id]/characters — list page: detects characters from script analysis, shows configured vs. unconfigured
- /projects/[id]/characters/[characterId] — editor: compliance warning, age slider (18–80), description, personality, voice dropdown, pace/range selects, accent, live preview
- components/ui/slider.tsx — native range input with gradient fill
- tsconfig.workers.json — separate tsconfig for ts-node workers (CommonJS + tsconfig-paths)

Phase 5 complete:
- Prisma schema updated: SCENE_GENERATE (JobType), PAUSED (JobStatus), NEEDS_REVIEW (ShotStatus); Shot fields: prompt, thumbnailPath, likenessChecked, likenessCheckPassed, likenessMatchedName, likenessScore, flaggedReason, generationCostUsd; Job fields: metadata (checkpoint), totalShots, completedShots
- lib/storage.ts — Cloudflare R2 client (S3-compatible), upload/download/signedUrl/delete helpers
- lib/generators/video.ts — buildShotPrompt() (shot type + characters + location + lighting + camera + compliance guardrails), runwayGenerate() (Gen-3 Alpha Turbo, async poll), replicateGenerate() (zeroscope-v2-xl fallback), generateShot() with R2 upload
- lib/compliance/likeness-check.ts — AWS Rekognition RecognizeCelebrities, frame extraction via ffmpeg, opt-in via LIKENESS_CHECK_ENABLED env var
- lib/queues.ts — added sceneGenerateQueue ("scene-generate")
- workers/scene-generation.worker.ts — processes shots sequentially, checkpoint saving to Job.metadata after each shot, pause/cancel detection between shots, likeness check per shot, NEEDS_REVIEW on flag
- workers/index.ts — registers both script-parse and scene-generation workers, SIGINT handler added
- /api/jobs/[id] — GET job+scenes status; POST pause|resume|cancel with state-transition validation
- /api/jobs/[id]/progress — SSE endpoint polling DB every 2s, pushes job+shots state, auto-closes on terminal status
- /api/projects/[id]/generate — POST: compliance gate (all characters confirmed fictional), creates Scene+Shot records from parsedData, enqueues one BullMQ job per scene, returns jobId
- /projects/[id]/generate — generation dashboard server page
- /projects/[id]/generate/_components/generation-board.tsx — production board with per-shot cards (thumbnail/status/cost), SSE live updates, Start/Pause/Resume/Cancel buttons, cost meter, flagged-shot warnings

## Coding Conventions
- Use TypeScript everywhere, no plain JS files
- Use async/await, never callbacks
- Every API route returns { data, error } shape
- All database calls go through /lib/db.ts
- Name files with kebab-case (my-component.tsx)
- Use Zod for all input validation
