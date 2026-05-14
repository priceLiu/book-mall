-- 分析室方案 A：与 tool-web catalog 8 个模型一一对应，补全 ToolBillablePrice（原仅默认模型一条）。
-- 点数与 visual-lab-analysis-scheme-a-catalog × retailMultiplier 2 一致（等价 0.35M 入 + 0.57M 出）。

INSERT INTO "ToolBillablePrice" (
  "id",
  "toolKey",
  "action",
  "pricePoints",
  "effectiveFrom",
  "effectiveTo",
  "active",
  "note",
  "schemeARefModelKey",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'seed_tbprice_vlab_qwen36flash',
    'visual-lab__analysis',
    'invoke',
    905,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen3.6-flash · 0<Token≤256K · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen3.6-flash',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwen35plus',
    'visual-lab__analysis',
    'invoke',
    603,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen3.5-plus · 0<Token≤128K · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen3.5-plus',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwen35flash',
    'visual-lab__analysis',
    'invoke',
    242,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen3.5-flash · 0<Token≤128K · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen3.5-flash',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwen3vlplus',
    'visual-lab__analysis',
    'invoke',
    1210,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen3-vl-plus · 0<Token≤32K · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen3-vl-plus',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwen3vlflash',
    'visual-lab__analysis',
    'invoke',
    182,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen3-vl-flash · 0<Token≤32K · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen3-vl-flash',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwenvlmax',
    'visual-lab__analysis',
    'invoke',
    568,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen-vl-max · 无阶梯 · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen-vl-max',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_tbprice_vlab_qwenvlplus',
    'visual-lab__analysis',
    'invoke',
    284,
    TIMESTAMP '2026-05-13 08:00:00',
    NULL,
    true,
    '方案 A 参考：qwen-vl-plus · 无阶梯 · 等价 0.35M 入 + 0.57M 出；实扣以 costPoints 为准',
    'qwen-vl-plus',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "pricePoints" = EXCLUDED."pricePoints",
  "effectiveFrom" = EXCLUDED."effectiveFrom",
  "effectiveTo" = EXCLUDED."effectiveTo",
  "active" = EXCLUDED."active",
  "note" = EXCLUDED."note",
  "updatedAt" = CURRENT_TIMESTAMP,
  "schemeARefModelKey" = EXCLUDED."schemeARefModelKey";

UPDATE "ToolBillablePrice"
SET
  "note" = '方案 A 参考：qwen3.6-plus · 0<Token≤256K · 等价 0.35M 入 + 0.57M 出；实扣以工具站 costPoints 为准',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed_tbprice_visual_lab_analysis_invoke';
