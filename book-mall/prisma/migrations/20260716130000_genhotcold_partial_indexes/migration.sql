-- Gen-HotCold-R2 · Phase 0：在飞任务 / RUNNING 日志部分索引（动静分离）
-- 目的：poll / dispatch / queue 扫描只命中「在飞」小索引，与表总行数无关。
-- 说明：Prisma schema 无法表达 partial index（WHERE 子句），故以裸 SQL 管理。
--       生产大表如需避免短暂写锁，可改为手工 CREATE INDEX CONCURRENTLY（不能在事务内）。

-- CanvasGenerationTask：在飞集合 = QUEUED | DISPATCHING | PENDING | SUBMITTED
CREATE INDEX IF NOT EXISTS "CanvasGenerationTask_inflight_queuedAt_idx"
  ON "CanvasGenerationTask" ("status", "queuedAt")
  WHERE "status" IN ('QUEUED', 'DISPATCHING', 'PENDING', 'SUBMITTED');

-- CanvasGenerationTask：SUBMITTED 轮询（按 lastPolledAt 取最久未轮询）
CREATE INDEX IF NOT EXISTS "CanvasGenerationTask_submitted_lastPolledAt_idx"
  ON "CanvasGenerationTask" ("lastPolledAt")
  WHERE "status" = 'SUBMITTED';

-- StoryGenerationTask：与 canvas 对齐（dispatch-story / poll-pool）
CREATE INDEX IF NOT EXISTS "StoryGenerationTask_inflight_queuedAt_idx"
  ON "StoryGenerationTask" ("status", "queuedAt")
  WHERE "status" IN ('QUEUED', 'DISPATCHING', 'PENDING', 'SUBMITTED');

CREATE INDEX IF NOT EXISTS "StoryGenerationTask_submitted_lastPolledAt_idx"
  ON "StoryGenerationTask" ("lastPolledAt")
  WHERE "status" = 'SUBMITTED';

-- GatewayRequestLog：RUNNING + 有厂商 taskId 的在飞日志（poll-service 两条 lane / poll-pool）
CREATE INDEX IF NOT EXISTS "GatewayRequestLog_running_submittedAt_idx"
  ON "GatewayRequestLog" ("submittedAt")
  WHERE "status" = 'RUNNING' AND "externalTaskId" IS NOT NULL;
