-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "themeId" TEXT;

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "sourcePlatform" TEXT,
    "referenceFramePaths" TEXT,
    "coverFrameIndex" INTEGER NOT NULL DEFAULT 0,
    "colorPalette" TEXT,
    "colorMood" TEXT,
    "colorTemperature" TEXT,
    "saturation" TEXT,
    "contrast" TEXT,
    "genre" TEXT,
    "tone" TEXT,
    "visualStyle" TEXT,
    "audioStyle" TEXT,
    "lightingStyle" TEXT,
    "cameraMovement" TEXT,
    "dominantShotTypes" TEXT,
    "pacing" TEXT,
    "avgShotDurationSeconds" DOUBLE PRECISION,
    "characterAgeRange" TEXT,
    "characterAppearance" TEXT,
    "characterMood" TEXT,
    "primaryEnvironment" TEXT,
    "timeOfDay" TEXT,
    "environmentDescription" TEXT,
    "musicGenre" TEXT,
    "musicMood" TEXT,
    "musicTempo" TEXT,
    "audioNotes" TEXT,
    "visualPromptModifier" TEXT,
    "audioPromptModifier" TEXT,
    "cinematographyNotes" TEXT,
    "analysisRawJson" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

