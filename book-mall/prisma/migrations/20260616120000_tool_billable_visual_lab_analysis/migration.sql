-- 视觉实验室 · 分析室：每次发起分析请求扣费一次（与 tool-web VISUAL_LAB_ANALYSIS_* 常量一致，后台可调）

INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "pricePoints", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES
  (
    'seed_tbprice_visual_lab_analysis_invoke',
    'visual-lab__analysis',
    'invoke',
    1500,
    TIMESTAMP '2026-01-01 00:00:00',
    NULL,
    true,
    '分析室单次请求 · 默认 1500 点（¥15）；与上游 Token 用量无关',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
