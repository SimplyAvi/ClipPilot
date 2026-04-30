-- Link generated characters back to the theme that created them.
ALTER TABLE "Character" ADD COLUMN "generatedFromThemeId" TEXT;

CREATE INDEX "Character_generatedFromThemeId_idx" ON "Character"("generatedFromThemeId");

ALTER TABLE "Character"
ADD CONSTRAINT "Character_generatedFromThemeId_fkey"
FOREIGN KEY ("generatedFromThemeId") REFERENCES "Theme"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
