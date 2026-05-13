-- 图生 / 参考 / 文生视频单次计费：10 元 -> 15 元（priceMinor 分）

UPDATE "ToolBillablePrice"
SET
  "priceMinor" = 1500,
  "note" = '图生/参考/文生视频，15元/次',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "toolKey" = 'image-to-video'
  AND "action" = 'invoke'
  AND "active" = true;
