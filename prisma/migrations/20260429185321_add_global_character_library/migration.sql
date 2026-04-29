-- Promote project-scoped characters into a global character library while
-- preserving existing character identity, description, and voice settings.

-- Add the new global-library fields first so old data can be copied across.
ALTER TABLE "Character"
ADD COLUMN "age" INTEGER,
ADD COLUMN "biography" TEXT,
ADD COLUMN "ethnicity" TEXT,
ADD COLUMN "fears" TEXT,
ADD COLUMN "forbiddenChanges" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "gestureTendencies" TEXT,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "motivations" TEXT,
ADD COLUMN "personality" TEXT,
ADD COLUMN "physicalDescription" TEXT,
ADD COLUMN "portraitPath" TEXT,
ADD COLUMN "portraitPrompt" TEXT,
ADD COLUMN "portraitStyle" TEXT,
ADD COLUMN "quirks" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "tags" TEXT,
ADD COLUMN "voiceAccent" TEXT,
ADD COLUMN "voiceId" TEXT,
ADD COLUMN "voiceNotes" TEXT,
ADD COLUMN "voicePace" TEXT,
ADD COLUMN "voiceTone" TEXT;

ALTER TABLE "Character"
ALTER COLUMN "emotionalRange" DROP NOT NULL,
ALTER COLUMN "emotionalRange" DROP DEFAULT;

UPDATE "Character"
SET
  "age" = "ageAppearance",
  "physicalDescription" = "description",
  "personality" = "personalityNotes",
  "voiceId" = "elevenLabsVoiceId",
  "voicePace" = "speakingPace",
  "voiceAccent" = "accent",
  "voiceNotes" = "voiceName";

CREATE TABLE "ProjectCharacter" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleInProject" TEXT,
    "scenesAppearedIn" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCharacter_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProjectCharacter" ("id", "characterId", "projectId", "addedAt")
SELECT 'pc_' || md5("id" || "projectId"), "id", "projectId", "createdAt"
FROM "Character"
WHERE "projectId" IS NOT NULL;

CREATE TABLE "CharacterPortraitGeneration" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "style" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flaggedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterPortraitGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectCharacter_projectId_idx" ON "ProjectCharacter"("projectId");
CREATE INDEX "ProjectCharacter_characterId_idx" ON "ProjectCharacter"("characterId");
CREATE UNIQUE INDEX "ProjectCharacter_characterId_projectId_key" ON "ProjectCharacter"("characterId", "projectId");
CREATE INDEX "CharacterPortraitGeneration_characterId_idx" ON "CharacterPortraitGeneration"("characterId");

ALTER TABLE "Character" DROP CONSTRAINT "Character_projectId_fkey";
DROP INDEX "Character_projectId_idx";

ALTER TABLE "Character"
DROP COLUMN "accent",
DROP COLUMN "ageAppearance",
DROP COLUMN "confirmedFictional",
DROP COLUMN "description",
DROP COLUMN "elevenLabsVoiceId",
DROP COLUMN "personalityNotes",
DROP COLUMN "projectId",
DROP COLUMN "speakingPace",
DROP COLUMN "voiceName";

ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterPortraitGeneration" ADD CONSTRAINT "CharacterPortraitGeneration_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
