-- 存量法律文档补签战役：无待补签用户后由系统写入 false，关闭 Gate 与登录 JWT 法律列读取
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "aiLegalLegacyBackfillActive" BOOLEAN NOT NULL DEFAULT true;