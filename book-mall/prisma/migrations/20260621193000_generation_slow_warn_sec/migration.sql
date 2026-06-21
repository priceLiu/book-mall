-- PlatformConfig · 生成耗时预警（秒）
ALTER TABLE "PlatformConfig"
ADD COLUMN IF NOT EXISTS "generationSlowWarnSec" INTEGER NOT NULL DEFAULT 800;
