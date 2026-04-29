-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "targetLength" TEXT,
ADD COLUMN     "tone" TEXT;

-- CreateTable
CREATE TABLE "VideoAnalytics" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "watchTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clickThroughRate" DOUBLE PRECISION,
    "averageViewDuration" DOUBLE PRECISION,
    "retentionRate" DOUBLE PRECISION,

    CONSTRAINT "VideoAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "durationSeconds" INTEGER,
    "cost" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalytics_socialPostId_key" ON "VideoAnalytics"("socialPostId");

-- CreateIndex
CREATE INDEX "VideoAnalytics_platform_idx" ON "VideoAnalytics"("platform");

-- CreateIndex
CREATE INDEX "ProjectCost_projectId_idx" ON "ProjectCost"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCost_provider_idx" ON "ProjectCost"("provider");

-- AddForeignKey
ALTER TABLE "VideoAnalytics" ADD CONSTRAINT "VideoAnalytics_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
