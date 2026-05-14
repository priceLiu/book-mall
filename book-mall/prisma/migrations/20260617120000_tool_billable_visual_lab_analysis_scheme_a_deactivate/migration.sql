-- 分析室改由工具站方案 A 经 costPoints 上报；停用主站一口价行，避免价格表与实扣不一致。

UPDATE "ToolBillablePrice"
SET
  "active" = false,
  "note" = '已由工具站方案 A 按所选模型动态 costPoints 计价；此条停用',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_visual_lab_analysis_invoke';
