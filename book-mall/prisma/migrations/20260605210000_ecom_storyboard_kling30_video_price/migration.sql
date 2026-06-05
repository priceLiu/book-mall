-- 故事版整图成片 · KIE 可灵 3.0 多图参考视频定价
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "tierLabel", "billingKind",
  "unitCostYuan", "retailMultiplier", "ourUnitYuan", "effectiveAt", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_video_kling30', 'ecom-toolkit__storyboard', 'video', 'kling-3.0/video', '1080P', 'VIDEO_MODEL_SPEC', 0.9, 2, 180, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
