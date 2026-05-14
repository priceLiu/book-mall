-- AI 试衣 / 文生图 / 图生视频：改由工具站方案 A 经 costPoints 上报；停用主站单行标价以免与实扣不一致。

UPDATE "ToolBillablePrice"
SET
  "active" = false,
  "note" = '已由工具站方案 A 经 costPoints 计价；此条停用',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "id" IN (
    'seed_tbprice_text_img_invoke',
    'seed_tbprice_image_video_invoke',
    'seed_tbprice_ai_fit_tryon',
    'seed_tbprice_fitting_room_tryon'
  );
