-- canvas/story 任务 ↔ Gateway 日志对账：提交超时但其实成功时，凭 storyTaskId 找回孤儿日志并 promote，
-- 避免自愈重派再次 createTask（重复扣费 + 假性失败）。dispatch 路径会按 storyTaskId 点查，需索引。
--
-- 注：GatewayRequestLog 在生产可能很大，普通 CREATE INDEX 会短暂锁写。
-- 如表很大，可改为在维护窗口手动执行：
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "GatewayRequestLog_storyTaskId_idx" ON "GatewayRequestLog"("storyTaskId");
-- 然后用 `prisma migrate resolve --applied 20260717090000_gateway_log_story_task_id_index` 标记已应用。
CREATE INDEX IF NOT EXISTS "GatewayRequestLog_storyTaskId_idx" ON "GatewayRequestLog"("storyTaskId");
