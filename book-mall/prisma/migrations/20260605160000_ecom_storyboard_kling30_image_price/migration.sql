-- 微剧故事版 · 可灵 3.0 Omni 分镜生图价目
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_img_kling30', 'ecom-toolkit__storyboard', 'image', 'kling-3.0-image', '无阶梯计价', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
