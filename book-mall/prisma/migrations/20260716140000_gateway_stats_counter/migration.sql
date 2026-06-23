-- Gen-HotCold-R2 · Phase 2：Gateway 状态投影计数表
CREATE TABLE IF NOT EXISTS "GatewayStatsCounter" (
  "scopeKey"       TEXT NOT NULL,
  "bucket"         TEXT NOT NULL DEFAULT 'live',
  "inProgress"     INTEGER NOT NULL DEFAULT 0,
  "succeeded"      INTEGER NOT NULL DEFAULT 0,
  "failed"         INTEGER NOT NULL DEFAULT 0,
  "cancelled"      INTEGER NOT NULL DEFAULT 0,
  "queued"         INTEGER NOT NULL DEFAULT 0,
  "slowWarn"       INTEGER NOT NULL DEFAULT 0,
  "backgroundWait" INTEGER NOT NULL DEFAULT 0,
  "computedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GatewayStatsCounter_pkey" PRIMARY KEY ("scopeKey", "bucket")
);

CREATE INDEX IF NOT EXISTS "GatewayStatsCounter_computedAt_idx"
  ON "GatewayStatsCounter" ("computedAt");
