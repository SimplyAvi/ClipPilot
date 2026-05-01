-- Add project-level video provider preferences.
ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "videoProvider" TEXT NOT NULL DEFAULT 'runway';

ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "videoAspectRatio" TEXT NOT NULL DEFAULT '16:9';

-- Singleton settings row for app-wide defaults.
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "defaultVideoProvider" TEXT NOT NULL DEFAULT 'runway',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
