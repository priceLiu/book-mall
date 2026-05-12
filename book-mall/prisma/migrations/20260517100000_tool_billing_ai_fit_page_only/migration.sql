-- 计费锚定：实际扣费发生在「AI试衣」页，toolKey = fitting-room__ai-fit，action = try_on。
-- 重新启用该定价行并规范化备注名；停用「试衣间整组合并」键 fitting-room + try_on。
UPDATE "ToolBillablePrice"
SET
    "active" = true,
    "note" = 'AI试衣页 · try_on（大模型），1元/次',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_ai_fit_tryon';

UPDATE "ToolBillablePrice"
SET
    "active" = false,
    "note" = '停用：计费入口改为 AI试衣页（fitting-room__ai-fit）',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_fitting_room_tryon';
