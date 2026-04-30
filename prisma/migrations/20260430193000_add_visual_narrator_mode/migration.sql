-- CreateTable
CREATE TABLE "NarratorProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "voiceId" TEXT,
    "voiceName" TEXT,
    "gender" TEXT,
    "pace" TEXT NOT NULL DEFAULT 'measured',
    "tone" TEXT,
    "emotionalRange" TEXT NOT NULL DEFAULT 'medium',
    "deliveryStyle" TEXT,
    "previewAudioPath" TEXT,
    "pauseSeconds" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarratorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualSegment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stanzaIndex" INTEGER NOT NULL,
    "stanzaText" TEXT NOT NULL,
    "visualConcept" TEXT NOT NULL,
    "primarySubject" TEXT NOT NULL,
    "movementStyle" TEXT NOT NULL,
    "cameraApproach" TEXT NOT NULL,
    "colorTemperature" TEXT NOT NULL,
    "emotionalQuality" TEXT,
    "additionalNotes" TEXT,
    "generationPrompt" TEXT,
    "generatedVideoPath" TEXT,
    "approvedVariantIdx" INTEGER NOT NULL DEFAULT 0,
    "variantPaths" TEXT,
    "narratorAudioPath" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMusicTrack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mood" TEXT,
    "tempo" TEXT,
    "style" TEXT,
    "primaryInstrument" TEXT,
    "silenceUsage" TEXT,
    "emotionalArc" TEXT,
    "audioPath" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "generationPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NarratorProfile_projectId_key" ON "NarratorProfile"("projectId");

-- CreateIndex
CREATE INDEX "VisualSegment_projectId_idx" ON "VisualSegment"("projectId");

-- CreateIndex
CREATE INDEX "VisualSegment_projectId_sortOrder_idx" ON "VisualSegment"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMusicTrack_projectId_key" ON "ProjectMusicTrack"("projectId");

-- AddForeignKey
ALTER TABLE "NarratorProfile" ADD CONSTRAINT "NarratorProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualSegment" ADD CONSTRAINT "VisualSegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMusicTrack" ADD CONSTRAINT "ProjectMusicTrack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

