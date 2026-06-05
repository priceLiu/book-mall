-- 微剧故事版 · wan2.6-image 多图参考生图价目（替换误标的 wan2.6-t2i）
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_img_wan26_image', 'ecom-toolkit__storyboard', 'image', 'wan2.6-image', '无阶梯计价', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "ToolBillablePrice"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tbp_ecom_storyboard_img_wan26';
