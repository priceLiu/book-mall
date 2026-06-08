-- 资产共享（租户体系 · 里程碑 5）
-- 为跨工具资产表新增 tenantId / ownerUserId / visibility，并回填 ownerUserId = userId。

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AssetVisibility" AS ENUM ('PRIVATE', 'TEAM_PUBLIC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TextToImageLibraryItem
ALTER TABLE "TextToImageLibraryItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "TextToImageLibraryItem" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "TextToImageLibraryItem" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "TextToImageLibraryItem" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "TextToImageLibraryItem_tenantId_visibility_createdAt_idx" ON "TextToImageLibraryItem"("tenantId", "visibility", "createdAt");

-- ImageToVideoLibraryItem
ALTER TABLE "ImageToVideoLibraryItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ImageToVideoLibraryItem" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "ImageToVideoLibraryItem" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "ImageToVideoLibraryItem" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "ImageToVideoLibraryItem_tenantId_visibility_createdAt_idx" ON "ImageToVideoLibraryItem"("tenantId", "visibility", "createdAt");

-- EcomAsset
ALTER TABLE "EcomAsset" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EcomAsset" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "EcomAsset" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "EcomAsset" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "EcomAsset_tenantId_visibility_createdAt_idx" ON "EcomAsset"("tenantId", "visibility", "createdAt");

-- EcomStoryboardProject
ALTER TABLE "EcomStoryboardProject" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EcomStoryboardProject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "EcomStoryboardProject" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "EcomStoryboardProject" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "EcomStoryboardProject_tenantId_visibility_updatedAt_idx" ON "EcomStoryboardProject"("tenantId", "visibility", "updatedAt");

-- StoryProject
ALTER TABLE "StoryProject" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "StoryProject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "StoryProject" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "StoryProject" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "StoryProject_tenantId_visibility_updatedAt_idx" ON "StoryProject"("tenantId", "visibility", "updatedAt");

-- CanvasProject
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE';
UPDATE "CanvasProject" SET "ownerUserId" = "userId" WHERE "ownerUserId" IS NULL;
CREATE INDEX IF NOT EXISTS "CanvasProject_tenantId_visibility_updatedAt_idx" ON "CanvasProject"("tenantId", "visibility", "updatedAt");
