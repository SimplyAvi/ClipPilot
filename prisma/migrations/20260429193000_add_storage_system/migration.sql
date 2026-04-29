CREATE TABLE "StorageSetting" (
    "id" TEXT NOT NULL,
    "localRootPath" TEXT,
    "useLocalStorage" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageSetting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
ADD COLUMN "projectSlug" TEXT,
ADD COLUMN "storageFolderInitialized" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Project_projectSlug_key" ON "Project"("projectSlug");

ALTER TABLE "Scene"
ADD COLUMN "assembledPath" TEXT,
ADD COLUMN "assembledBackend" TEXT;

ALTER TABLE "Shot"
ADD COLUMN "storageBackend" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN "storagePath" TEXT;
