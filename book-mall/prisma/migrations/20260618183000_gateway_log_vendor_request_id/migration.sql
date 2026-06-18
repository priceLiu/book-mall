-- Gateway 日志：厂商 HTTP Request ID（排障，区别于 externalTaskId 异步任务 id）
ALTER TABLE "GatewayRequestLog" ADD COLUMN IF NOT EXISTS "vendorRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "GatewayRequestLog_vendorRequestId_idx"
  ON "GatewayRequestLog"("vendorRequestId");
