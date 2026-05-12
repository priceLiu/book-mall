-- 试衣间各子路由（套装 / AI试衣 / 我的衣柜）统一按工具键 fitting-room 计费；停用旧键 fitting-room__ai-fit 的单价行，避免重复生效。
UPDATE "ToolBillablePrice"
SET "active" = false,
    "note" = '已由 fitting-room 统一计价替代（迁移）',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_ai_fit_tryon';

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "priceMinor", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES
    ('seed_tbprice_fitting_room_tryon', 'fitting-room', 'try_on', 100, TIMESTAMP '2026-05-12 00:00:00', NULL, true, '试衣间统一计价（套装/AI试衣/衣柜同属一试衣间），1元/次', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
