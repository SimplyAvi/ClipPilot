-- AlterTable
ALTER TABLE "Scene" ADD COLUMN "firstImagePath" TEXT,
ADD COLUMN "durationSeconds" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RunwayClip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "sceneIndex" INTEGER NOT NULL,
    "clipIndex" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "runwayTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "videoPath" TEXT,
    "muxedVideoPath" TEXT,
    "audioPath" TEXT,
    "startImagePath" TEXT NOT NULL,
    "endImagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunwayClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssembledVideo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoPath" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssembledVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunwayClip_projectId_clipId_key" ON "RunwayClip"("projectId", "clipId");

-- CreateIndex
CREATE INDEX "RunwayClip_projectId_sceneIndex_idx" ON "RunwayClip"("projectId", "sceneIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AssembledVideo_projectId_key" ON "AssembledVideo"("projectId");

-- AddForeignKey
ALTER TABLE "RunwayClip" ADD CONSTRAINT "RunwayClip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssembledVideo" ADD CONSTRAINT "AssembledVideo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
