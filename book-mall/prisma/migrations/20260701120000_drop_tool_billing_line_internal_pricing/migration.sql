-- v005 (2026-05-17)：删除 ToolBillingDetailLine 的「对内计价快照」7 列。
--
-- 背景：v002 引入这 7 列时同时**也**把同样的快照写入 cloudRow JSON 的「对内计价/*」6 键，
-- 长期是"双写"。v004 cloudRow 改为写「平台/系数(M) + 平台/定价 + 平台/扣点」，DB internal*
-- 仍冗余保留作为"审计冗余"。v005 起删除冗余，"对内计价快照"单一数据源 = cloudRow JSON。
--
-- 所有读端（reconciliation 聚合 / usage-overview 趋势卡片 / enrichBillingLineToFlatRow）
-- 均改为从 cloudRow JSON 读取；详见同时段提交的 `lib/finance/cloud-bill-enrich.ts` 等改动。
--
-- 本迁移**与 reset 配套执行**：脚本 `scripts/reset-billing-data.ts --apply` 已清空 TBDL 表，
-- 因此 DROP COLUMN 不会丢"无法恢复"的历史快照（v005 后所有新行 cloudRow 都自带 8 列平台数据）。

ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalCloudCostUnitYuan";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalRetailMultiplier";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalOurUnitYuan";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalFormulaText";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalChargedPoints";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalYuanReference";
ALTER TABLE "ToolBillingDetailLine" DROP COLUMN IF EXISTS "internalCapturedAt";
