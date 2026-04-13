-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MUSIC', 'VOICE', 'IMAGE', 'VIDEO', 'AUDIO', 'AI_GENERATED', 'FOOTAGE');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('CC0', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'PIXABAY', 'ROYALTY_FREE', 'ELEVENLABS_COMMERCIAL', 'RUNWAY_COMMERCIAL', 'LICENSED', 'GENERATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SCRIPT_PARSE', 'IMAGE_GENERATE', 'VIDEO_GENERATE', 'VOICE_GENERATE', 'MUSIC_SELECT', 'VIDEO_ASSEMBLE', 'CONTENT_ID_CHECK', 'SCENE_GENERATE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'ASSETS_READY', 'RENDERED');

-- CreateEnum
CREATE TYPE "ShotStatus" AS ENUM ('DRAFT', 'GENERATING', 'COMPLETE', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "DialogueStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportPlatform" AS ENUM ('YOUTUBE_SHORTS', 'INSTAGRAM_REELS', 'TIKTOK', 'YOUTUBE_STANDARD');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'ASSEMBLING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProviderKey" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageAppearance" INTEGER,
    "description" TEXT,
    "personalityNotes" TEXT,
    "elevenLabsVoiceId" TEXT,
    "voiceName" TEXT,
    "speakingPace" TEXT NOT NULL DEFAULT 'normal',
    "emotionalRange" TEXT NOT NULL DEFAULT 'moderate',
    "accent" TEXT,
    "confirmedFictional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parsedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "licenseType" "LicenseType" NOT NULL,
    "licenseUrl" TEXT,
    "licenseScreenshotUrl" TEXT,
    "commercialUse" BOOLEAN,
    "monetizationAllowed" BOOLEAN,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "attributionText" TEXT,
    "contentIdChecked" BOOLEAN NOT NULL DEFAULT false,
    "contentIdClear" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "costSoFar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION,
    "error" TEXT,
    "metadata" JSONB,
    "totalShots" INTEGER NOT NULL DEFAULT 0,
    "completedShots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "timeOfDay" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotNumber" INTEGER NOT NULL,
    "shotType" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "generatedVideoPath" TEXT,
    "thumbnailPath" TEXT,
    "status" "ShotStatus" NOT NULL DEFAULT 'DRAFT',
    "prompt" TEXT,
    "likenessChecked" BOOLEAN NOT NULL DEFAULT false,
    "likenessCheckPassed" BOOLEAN,
    "likenessMatchedName" TEXT,
    "likenessScore" DOUBLE PRECISION,
    "flaggedReason" TEXT,
    "generationCostUsd" DOUBLE PRECISION,
    "mixedAudioPath" TEXT,
    "dialogueStemPath" TEXT,
    "musicStemPath" TEXT,
    "lipSyncedVideoPath" TEXT,
    "lipSyncStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogueLine" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "characterId" TEXT,
    "lineIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "deliveryDirection" TEXT,
    "audioPath" TEXT,
    "startTimeSec" DOUBLE PRECISION,
    "endTimeSec" DOUBLE PRECISION,
    "durationSec" DOUBLE PRECISION,
    "status" "DialogueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialogueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "ExportPlatform" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "videoR2Key" TEXT,
    "pdfR2Key" TEXT,
    "durationSec" DOUBLE PRECISION,
    "fileSizeBytes" INTEGER,
    "complianceSnapshot" JSONB,
    "aiDisclosureApplied" BOOLEAN NOT NULL DEFAULT false,
    "disclosureTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneMusicCue" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "startPointSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fadeInSec" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "fadeOutSec" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "volumeDb" DOUBLE PRECISION NOT NULL DEFAULT -12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneMusicCue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderKey_provider_key" ON "ProviderKey"("provider");

-- CreateIndex
CREATE INDEX "Character_projectId_idx" ON "Character"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "DialogueLine_shotId_idx" ON "DialogueLine"("shotId");

-- CreateIndex
CREATE INDEX "Export_projectId_idx" ON "Export"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneMusicCue_sceneId_key" ON "SceneMusicCue"("sceneId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogueLine" ADD CONSTRAINT "DialogueLine_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogueLine" ADD CONSTRAINT "DialogueLine_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneMusicCue" ADD CONSTRAINT "SceneMusicCue_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneMusicCue" ADD CONSTRAINT "SceneMusicCue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
