-- 微剧故事版 · 万相 2.7 / 2.6 多图参考生图价目
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_img_wan27', 'ecom-toolkit__storyboard', 'image', 'wan2.7-image', '无阶梯计价', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_img_wan27_pro', 'ecom-toolkit__storyboard', 'image', 'wan2.7-image-pro', '无阶梯计价', 'OUTPUT_IMAGE', 0.30, 2, 60, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_img_wan26', 'ecom-toolkit__storyboard', 'image', 'wan2.6-t2i', '无阶梯计价', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
