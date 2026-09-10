-- 全局资产库 · 服装库 + 全身模特 + 模特头像库 scope 扩展

ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "thumbUrl" TEXT;
ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EcomModelLibraryEntry" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "EcomModelLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomModelLibraryEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomModelLibraryEntry_tenantId_deletedAt_idx"
  ON "EcomModelLibraryEntry"("tenantId", "deletedAt");

CREATE TABLE IF NOT EXISTS "EcomGarmentLibraryEntry" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "ossUrl" TEXT NOT NULL,
  "thumbUrl" TEXT,
  "garmentKind" TEXT NOT NULL DEFAULT 'flat',
  "sourceImageKey" TEXT,
  "tags" JSONB,
  "scope" TEXT NOT NULL DEFAULT 'platform',
  "userId" TEXT,
  "tenantId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EcomGarmentLibraryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EcomGarmentLibraryEntry_gender_deletedAt_idx"
  ON "EcomGarmentLibraryEntry"("gender", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomGarmentLibraryEntry_scope_userId_deletedAt_idx"
  ON "EcomGarmentLibraryEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomGarmentLibraryEntry_tenantId_deletedAt_idx"
  ON "EcomGarmentLibraryEntry"("tenantId", "deletedAt");

CREATE TABLE IF NOT EXISTS "EcomFullBodyModelEntry" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "ossUrl" TEXT NOT NULL,
  "thumbUrl" TEXT,
  "sourceAssetId" TEXT,
  "sourceImageKey" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'user',
  "userId" TEXT,
  "tenantId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EcomFullBodyModelEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EcomFullBodyModelEntry_gender_deletedAt_idx"
  ON "EcomFullBodyModelEntry"("gender", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomFullBodyModelEntry_scope_userId_deletedAt_idx"
  ON "EcomFullBodyModelEntry"("scope", "userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EcomFullBodyModelEntry_tenantId_deletedAt_idx"
  ON "EcomFullBodyModelEntry"("tenantId", "deletedAt");
