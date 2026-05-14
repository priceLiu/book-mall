-- 工具方案 A：全局零售系数规则（多条按 effectiveFrom 取当前命中的一条）
CREATE TABLE "ToolRetailMultiplierRule" (
    "id" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolRetailMultiplierRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ToolRetailMultiplierRule_effectiveFrom_idx" ON "ToolRetailMultiplierRule"("effectiveFrom");
CREATE INDEX "ToolRetailMultiplierRule_effectiveTo_idx" ON "ToolRetailMultiplierRule"("effectiveTo");

INSERT INTO "ToolRetailMultiplierRule" ("id", "multiplier", "effectiveFrom", "effectiveTo", "note", "createdAt", "updatedAt")
VALUES (
  'seed_trmr_scheme_a_default_2x',
  2.0,
  TIMESTAMP '2020-01-01 00:00:00',
  NULL,
  '方案 A 默认零售系数；新增规则时设置更晚的 effectiveFrom 可覆盖；effectiveTo 非空时可排期结束',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
