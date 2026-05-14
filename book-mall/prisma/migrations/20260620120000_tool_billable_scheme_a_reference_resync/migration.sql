-- 在方案 A 停用迁移之后执行：停用表中全部单价行，再以与 tool-web catalog × 零售系数 2 一致的「参考价」写回 5 条主种子行（启用）。
-- 用途：管理后台与 SSO billable-price 回退；单笔实扣仍以工具站上报 costPoints 为准。

UPDATE "ToolBillablePrice"
SET
  "active" = false,
  "updatedAt" = CURRENT_TIMESTAMP;

-- fitting-room + try_on：aitryon 0.2×2=0.40 元 → 40 点
INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES (
  'seed_tbprice_fitting_room_tryon',
  'fitting-room',
  'try_on',
  40,
  TIMESTAMP '2026-05-13 08:00:00',
  NULL,
  true,
  '方案 A 参考：catalog 默认试衣模型 aitryon（¥0.2/张×M=40 点）；实扣以工具站 costPoints 为准',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = true,
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES (
  'seed_tbprice_ai_fit_tryon',
  'fitting-room__ai-fit',
  'try_on',
  40,
  TIMESTAMP '2026-05-13 08:00:00',
  NULL,
  true,
  '方案 A 参考：AI 试衣页结算同上（40 点）；Plus 等模型实扣见 costPoints',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "toolKey" = EXCLUDED."toolKey",
  "action" = EXCLUDED."action",
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = true,
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES (
  'seed_tbprice_text_img_invoke',
  'text-to-image',
  'invoke',
  40,
  TIMESTAMP '2026-05-13 08:00:00',
  NULL,
  true,
  '方案 A 参考：默认文生图模型（¥0.2/张×M=40 点）；实扣以 costPoints 为准',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = true,
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES (
  'seed_tbprice_image_video_invoke',
  'image-to-video',
  'invoke',
  900,
  TIMESTAMP '2026-05-13 08:00:00',
  NULL,
  true,
  '方案 A 参考：happyhorse-1.0-i2v·约 5s 成片（实扣=时长×官网元/秒×M）；非此模型见 costPoints',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = true,
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES (
  'seed_tbprice_visual_lab_analysis_invoke',
  'visual-lab__analysis',
  'invoke',
  1508,
  TIMESTAMP '2026-05-13 08:00:00',
  NULL,
  true,
  '方案 A 参考：默认等价用量 + 目录默认模型 qwen3.6-plus（约 1508 点）；换模型见 costPoints',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = true,
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP;
