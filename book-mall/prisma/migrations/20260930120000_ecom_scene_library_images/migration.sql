-- 场景库参考图（与姿势库一致：主图 + 缩略图）
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "ossUrl" TEXT;
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "thumbUrl" TEXT;
ALTER TABLE "EcomSceneLibraryEntry" ADD COLUMN IF NOT EXISTS "sourceImageKey" TEXT;
