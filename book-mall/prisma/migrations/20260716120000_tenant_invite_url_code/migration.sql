-- 团队邀请链接 query 验证码（与短信链接一致，供管理端复制）
ALTER TABLE "TenantInvite" ADD COLUMN IF NOT EXISTS "urlCode" TEXT;
