-- 图生视频（HappyHorse i2v）：标价 5 元 / 次（invoke）

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "priceMinor", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES
  ('seed_tbprice_image_video_invoke', 'image-to-video', 'invoke', 500, TIMESTAMP '2026-05-13 00:00:00', NULL, true, '图生视频 HappyHorse i2v，5元/次', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
