-- 画布入库 · 项目/团队范围 + 用户风格库表

ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceProjectId" TEXT;

ALTER TABLE "EcomGarmentLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceProjectId" TEXT;

ALTER TABLE "EcomFullBodyModelEntry" ADD COLUMN IF NOT EXISTS "sourceProjectId" TEXT;

ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceProjectId" TEXT;

ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceProjectId" TEXT;

CREATE INDEX IF NOT EXISTS "EcomSceneLibraryEntry_tenantId_deletedAt_idx"
  ON "EcomSceneLibraryEntry"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomSceneLibraryEntry_sourceProjectId_deletedAt_idx"
  ON "EcomSceneLibraryEntry"("sourceProjectId", "deletedAt");

CREATE INDEX IF NOT EXISTS "EcomGarmentLibraryEntry_sourceProjectId_deletedAt_idx"
  ON "EcomGarmentLibraryEntry"("sourceProjectId", "deletedAt");

CREATE INDEX IF NOT EXISTS "EcomFullBodyModelEntry_sourceProjectId_deletedAt_idx"
  ON "EcomFullBodyModelEntry"("sourceProjectId", "deletedAt");

CREATE INDEX IF NOT EXISTS "EcomModelLibraryEntry_sourceProjectId_deletedAt_idx"
  ON "EcomModelLibraryEntry"("sourceProjectId", "deletedAt");

CREATE INDEX IF NOT EXISTS "EcomPoseLibraryEntry_tenantId_deletedAt_idx"
  ON "EcomPoseLibraryEntry"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomPoseLibraryEntry_sourceProjectId_deletedAt_idx"
  ON "EcomPoseLibraryEntry"("sourceProjectId", "deletedAt");

CREATE TABLE IF NOT EXISTS "EcomStyleLibraryEntry" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stylePrompt" TEXT NOT NULL,
  "ossUrl" TEXT,
  "thumbUrl" TEXT,
  "sourceImageKey" TEXT,
  "tags" JSONB,
  "scope" TEXT NOT NULL DEFAULT 'platform',
  "userId" TEXT,
  "tenantId" TEXT,
  "sourceProjectId" TEXT,
  "lockedAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EcomStyleLibraryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EcomStyleLibraryEntry_deletedAt_idx"
  ON "EcomStyleLibraryEntry"("deletedAt");
CREATE INDEX IF NOT EXISTS "EcomStyleLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomStyleLibraryEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomStyleLibraryEntry_tenantId_deletedAt_idx"
  ON "EcomStyleLibraryEntry"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomStyleLibraryEntry_sourceProjectId_deletedAt_idx"
  ON "EcomStyleLibraryEntry"("sourceProjectId", "deletedAt");
