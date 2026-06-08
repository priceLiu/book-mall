-- 故事版整图成片 · KIE Nano Banana Pro 多图参考视频定价
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_video_nano_banana', 'ecom-toolkit__storyboard', 'video', 'nano-banana-pro', '1080P', 'VIDEO_MODEL_SPEC', 0.9, 2, 180, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
