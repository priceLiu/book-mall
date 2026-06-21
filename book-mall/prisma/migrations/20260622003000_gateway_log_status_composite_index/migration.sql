-- 状态仪表盘 / 轮询池 / 在飞查询的复合索引：避免在大表上先扫 [status] 单列再按时间过滤。
-- 生产大表建议改用 CREATE INDEX CONCURRENTLY 手工执行后 `prisma migrate resolve --applied`，
-- 以免建索引期间锁表阻塞写入；以下为标准（事务内）写法，适用于中小表/本地。
CREATE INDEX IF NOT EXISTS "GatewayRequestLog_status_submittedAt_idx"
  ON "GatewayRequestLog" ("status", "submittedAt");

CREATE INDEX IF NOT EXISTS "GatewayRequestLog_status_lastPolledAt_idx"
  ON "GatewayRequestLog" ("status", "lastPolledAt");
