-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "audioStyle" TEXT NOT NULL,
    "targetPlatform" TEXT NOT NULL,
    "targetLength" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "sourceProjectId" TEXT,
    "thumbnailPath" TEXT,
    "characterConfig" TEXT,
    "musicConfig" TEXT,
    "generationConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
