-- 故事版整图成片 · 百炼 R2V 视频定价
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_video_hh_r2v', 'ecom-toolkit__storyboard', 'video', 'happyhorse-1.0-r2v', '1080P', 'VIDEO_MODEL_SPEC', 1.6, 2, 320, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_video_wan27_r2v', 'ecom-toolkit__storyboard', 'video', 'wan2.7-r2v', '1080P', 'VIDEO_MODEL_SPEC', 1.0, 2, 200, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_video_wan26_r2v', 'ecom-toolkit__storyboard', 'video', 'wan2.6-r2v', '1080P', 'VIDEO_MODEL_SPEC', 1.0, 2, 200, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
