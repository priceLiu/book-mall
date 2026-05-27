-- Gateway 请求日志 · 页面级来源（产品内 route slug）
ALTER TABLE "GatewayRequestLog" ADD COLUMN IF NOT EXISTS "clientPage" TEXT;
