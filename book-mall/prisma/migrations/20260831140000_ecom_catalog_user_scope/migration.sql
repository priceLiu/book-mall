-- AlterTable: user-owned catalog + lock on use
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

ALTER TABLE "EcomPropLibraryEntry" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "EcomPropLibraryEntry" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "EcomPropLibraryEntry" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "EcomPoseLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomPoseLibraryEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomPropLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomPropLibraryEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomSceneLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomSceneLibraryEntry"("scope", "userId", "deletedAt");
