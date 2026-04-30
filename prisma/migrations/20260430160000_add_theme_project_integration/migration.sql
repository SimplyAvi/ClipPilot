-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "productionMode" TEXT NOT NULL DEFAULT 'character_driven',
ADD COLUMN     "themeMode" TEXT NOT NULL DEFAULT 'single',
ADD COLUMN     "themeOverrideMode" TEXT NOT NULL DEFAULT 'fill_empty',
ADD COLUMN     "variantCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "productionMode" TEXT,
ADD COLUMN     "themeId" TEXT,
ADD COLUMN     "useProjectTheme" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "approvedVariantIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variantCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "variantPaths" TEXT;

-- CreateIndex
CREATE INDEX "Scene_themeId_idx" ON "Scene"("themeId");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

