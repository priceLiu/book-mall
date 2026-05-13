-- 图生视频单次计费：5 元 -> 10 元（priceMinor 分）
UPDATE "ToolBillablePrice"
SET
  "priceMinor" = 1000,
  "note" = '图生视频 i2v，10元/次',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "toolKey" = 'image-to-video'
  AND "action" = 'invoke'
  AND "active" = true;
