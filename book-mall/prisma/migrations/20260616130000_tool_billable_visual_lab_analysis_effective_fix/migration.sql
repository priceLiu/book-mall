-- 分析室标价：保证库内有一行且 effectiveFrom 已生效（避免仅执行了上一迁移但系统日期 < 2026-01-01 时永远匹配不到；或尚未插入该行）
-- 若上一迁移已插入，仅将生效起始时间提前；若未插入，则补插。

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
SELECT
  'seed_tbprice_visual_lab_analysis_invoke',
  'visual-lab__analysis',
  'invoke',
  1500,
  TIMESTAMP '2020-01-01 00:00:00',
  NULL,
  true,
  '分析室单次请求 · 默认 1500 点（¥15）；与上游 Token 用量无关',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ToolBillablePrice" WHERE "id" = 'seed_tbprice_visual_lab_analysis_invoke'
);

UPDATE "ToolBillablePrice"
SET
  "effectiveFrom" = TIMESTAMP '2020-01-01 00:00:00',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_visual_lab_analysis_invoke';
