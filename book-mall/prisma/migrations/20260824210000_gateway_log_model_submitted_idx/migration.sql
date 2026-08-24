-- 单模型日调用上限：createRequestLog 预检按 (model, submittedAt 当日) 计数
CREATE INDEX IF NOT EXISTS "GatewayRequestLog_model_submittedAt_idx"
  ON "GatewayRequestLog" ("model", "submittedAt");
