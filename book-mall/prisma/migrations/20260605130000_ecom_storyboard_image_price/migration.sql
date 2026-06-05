-- 微剧情分镜 · 生图与 Seedance 1.5 Pro 视频价目
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_img_turbo', 'ecom-toolkit__storyboard', 'image', 'wanx2.1-t2i-turbo', '无阶梯计价', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_img_plus', 'ecom-toolkit__storyboard', 'image', 'wanx2.1-t2i-plus', '无阶梯计价', 'OUTPUT_IMAGE', 0.30, 2, 60, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_video_15', 'ecom-toolkit__storyboard', 'video', 'doubao-seedance-1.5-pro', '1080P', 'VIDEO_MODEL_SPEC', 0.9, 2, 180, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
