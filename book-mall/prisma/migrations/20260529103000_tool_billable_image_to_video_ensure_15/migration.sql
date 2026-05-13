-- 确保 image-to-video / invoke 全部为 15 元（1500 分）
--
-- 背景：20260513160000 的 UPDATE 在「尚无 pricing 行」时影响 0 行；20260523120000
-- 再插入 5 元种子行。若仅依赖「active = true」的 UPDATE，在部分数据状态下仍可能漏改。
-- 本迁移不限制 active，凡 toolKey + action 匹配即统一为产品现价。

UPDATE "ToolBillablePrice"
SET
  "priceMinor" = 1500,
  "note" = '图生/参考/文生视频，15元/次',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "toolKey" = 'image-to-video'
  AND "action" = 'invoke';
