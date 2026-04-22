-- CreateEnum
CREATE TYPE "ThumbnailVariant" AS ENUM ('IMPACT_FRAME', 'CHARACTER_FOCUS', 'MOOD_ATMOSPHERE');

-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "language" TEXT,
    "durationSec" DOUBLE PRECISION,
    "rawResponse" JSONB NOT NULL,
    "captionStyle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptionSegment" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectThumbnail" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variant" "ThumbnailVariant" NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "youtubeR2Key" TEXT,
    "tiktokR2Key" TEXT,
    "squareR2Key" TEXT,
    "titleText" TEXT,
    "fontSize" TEXT NOT NULL DEFAULT 'large',
    "textColor" TEXT NOT NULL DEFAULT 'white',
    "textPosition" TEXT NOT NULL DEFAULT 'bottom',
    "textStyle" TEXT NOT NULL DEFAULT 'shadow',
    "baseFramePath" TEXT,
    "prompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectThumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "platformUserId" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transcription_projectId_key" ON "Transcription"("projectId");

-- CreateIndex
CREATE INDEX "CaptionSegment_transcriptionId_idx" ON "CaptionSegment"("transcriptionId");

-- CreateIndex
CREATE INDEX "ProjectThumbnail_projectId_idx" ON "ProjectThumbnail"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_key" ON "SocialAccount"("platform");

-- CreateIndex
CREATE INDEX "SocialPost_projectId_idx" ON "SocialPost"("projectId");

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionSegment" ADD CONSTRAINT "CaptionSegment_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "Transcription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectThumbnail" ADD CONSTRAINT "ProjectThumbnail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
