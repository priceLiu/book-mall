-- 微剧故事版 · Nano Banana Pro（KIE）分镜生图价目
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_img_nano_banana', 'ecom-toolkit__storyboard', 'image', 'nano-banana-pro', '无阶梯计价', 'OUTPUT_IMAGE', 0.30, 2, 60, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
