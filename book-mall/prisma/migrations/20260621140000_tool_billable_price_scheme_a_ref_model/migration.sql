-- ToolBillablePrice：方案 A 参考模型 id（可选），用于后台展示当前系数与反算成本；并修正错误 toolKey 写法

ALTER TABLE "ToolBillablePrice" ADD COLUMN "schemeARefModelKey" TEXT;

UPDATE "ToolBillablePrice"
SET "toolKey" = 'fitting-room__ai-fit',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "toolKey" IN ('fitting_room__ai-fit', 'fitting_room__ai_fit');

UPDATE "ToolBillablePrice"
SET "schemeARefModelKey" = 'aitryon', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_fitting_room_tryon';

UPDATE "ToolBillablePrice"
SET "schemeARefModelKey" = 'aitryon', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_ai_fit_tryon';

UPDATE "ToolBillablePrice"
SET "schemeARefModelKey" = 'wanx2.1-t2i-plus', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_text_img_invoke';

UPDATE "ToolBillablePrice"
SET "schemeARefModelKey" = 'happyhorse-1.0-i2v', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_image_video_invoke';

UPDATE "ToolBillablePrice"
SET "schemeARefModelKey" = 'qwen3.6-plus', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_visual_lab_analysis_invoke';
