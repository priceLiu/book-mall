-- Gen-HotCold-R2 · Phase 5A：日志 / 账本历史归档表（只读冷数据）
-- 用 LIKE 克隆主表结构以保证字段完全一致（含类型/默认值/枚举），不复制外键与索引，
-- 再补主键、archivedAt 列与精简索引。报表按时间在主表/归档表间路由。

-- ── GatewayRequestLogArchive ───────────────────────────────
CREATE TABLE IF NOT EXISTS "GatewayRequestLogArchive"
  (LIKE "GatewayRequestLog" INCLUDING DEFAULTS);

ALTER TABLE "GatewayRequestLogArchive"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GatewayRequestLogArchive_pkey'
  ) THEN
    ALTER TABLE "GatewayRequestLogArchive"
      ADD CONSTRAINT "GatewayRequestLogArchive_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GatewayRequestLogArchive_submittedAt_idx"
  ON "GatewayRequestLogArchive" ("submittedAt");
CREATE INDEX IF NOT EXISTS "GatewayRequestLogArchive_actor_submittedAt_idx"
  ON "GatewayRequestLogArchive" ("actorBookUserId", "submittedAt");
CREATE INDEX IF NOT EXISTS "GatewayRequestLogArchive_tenant_submittedAt_idx"
  ON "GatewayRequestLogArchive" ("tenantId", "submittedAt");
CREATE INDEX IF NOT EXISTS "GatewayRequestLogArchive_canonicalModelKey_idx"
  ON "GatewayRequestLogArchive" ("canonicalModelKey");

-- ── CreditLedgerArchive ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CreditLedgerArchive"
  (LIKE "CreditLedger" INCLUDING DEFAULTS);

ALTER TABLE "CreditLedgerArchive"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreditLedgerArchive_pkey'
  ) THEN
    ALTER TABLE "CreditLedgerArchive"
      ADD CONSTRAINT "CreditLedgerArchive_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedgerArchive_idempotencyKey_key"
  ON "CreditLedgerArchive" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CreditLedgerArchive_accountId_createdAt_idx"
  ON "CreditLedgerArchive" ("accountId", "createdAt");
