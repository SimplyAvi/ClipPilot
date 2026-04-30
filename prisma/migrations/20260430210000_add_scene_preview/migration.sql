CREATE TABLE "ScenePreview" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT,
    "visualSegmentId" TEXT,
    "projectId" TEXT NOT NULL,
    "testMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "shotsGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalShots" INTEGER NOT NULL DEFAULT 1,
    "previewVideoPath" TEXT,
    "previewThumbPath" TEXT,
    "generationPromptUsed" TEXT,
    "themeModifierUsed" TEXT,
    "costActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenePreview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScenePreview_sceneId_idx" ON "ScenePreview"("sceneId");
CREATE INDEX "ScenePreview_visualSegmentId_idx" ON "ScenePreview"("visualSegmentId");
CREATE INDEX "ScenePreview_projectId_createdAt_idx" ON "ScenePreview"("projectId", "createdAt");

ALTER TABLE "ScenePreview" ADD CONSTRAINT "ScenePreview_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenePreview" ADD CONSTRAINT "ScenePreview_visualSegmentId_fkey" FOREIGN KEY ("visualSegmentId") REFERENCES "VisualSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenePreview" ADD CONSTRAINT "ScenePreview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
