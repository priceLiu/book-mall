-- 姿势库 V2：参考图与去重键
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "ossUrl" TEXT;
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "thumbUrl" TEXT;
ALTER TABLE "EcomPoseLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceImageKey" TEXT;

CREATE INDEX IF NOT EXISTS "EcomPoseLibraryEntry_sourceImageKey_deletedAt_idx"
  ON "EcomPoseLibraryEntry"("sourceImageKey", "deletedAt");
