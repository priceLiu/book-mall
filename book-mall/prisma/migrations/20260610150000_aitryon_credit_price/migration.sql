-- aitryon / aitryon-plus：平台积分报价（试衣成片按输出 1 张计费）
-- 修复平台代付用户试衣成功但 creditsCharged=0（缺 ModelCostProfile + ModelCreditPrice）

INSERT INTO "ModelCostProfile" (
  "id",
  "canonicalModelKey",
  "vendor",
  "channel",
  "unit",
  "tierRaw",
  "listCostYuan",
  "discountRate",
  "netCostYuan",
  "active",
  "note",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'seed_aitryon_aliyun',
    'aitryon',
    'aliyun',
    'CHANNEL',
    'PER_IMAGE',
    NULL,
    0.2,
    0.1,
    0.18,
    true,
    'migration:20260610150000_aitryon_credit_price',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_aitryon_plus_aliyun',
    'aitryon-plus',
    'aliyun',
    'CHANNEL',
    'PER_IMAGE',
    NULL,
    0.5,
    0.1,
    0.45,
    true,
    'migration:20260610150000_aitryon_credit_price',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "listCostYuan" = EXCLUDED."listCostYuan",
  "discountRate" = EXCLUDED."discountRate",
  "netCostYuan" = EXCLUDED."netCostYuan",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ModelCreditPrice" (
  "id",
  "canonicalModelKey",
  "displayName",
  "vendor",
  "unit",
  "tierRaw",
  "netCostYuan",
  "marginM",
  "listPriceYuan",
  "creditsPerUnit",
  "baseMarginRate",
  "formulaSnapshot",
  "active",
  "publishedAt",
  "publishedBy"
)
VALUES
  (
    'mcp_aitryon',
    'aitryon',
    'AI 试衣-基础版',
    'aliyun',
    'PER_IMAGE',
    NULL,
    0.18,
    2.5,
    0.45,
    11,
    0.59,
    '{"source":"migration:20260610150000","listCostYuan":0.2,"discountRate":0.1,"netCostYuan":0.18,"marginM":2.5,"listPriceYuan":0.45,"creditsPerUnit":11,"anchorYuan":0.04}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    'migration:20260610150000'
  ),
  (
    'mcp_aitryon_plus',
    'aitryon-plus',
    'AI 试衣-Plus 版',
    'aliyun',
    'PER_IMAGE',
    NULL,
    0.45,
    2.5,
    1.125,
    28,
    0.60,
    '{"source":"migration:20260610150000","listCostYuan":0.5,"discountRate":0.1,"netCostYuan":0.45,"marginM":2.5,"listPriceYuan":1.125,"creditsPerUnit":28,"anchorYuan":0.04}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    'migration:20260610150000'
  )
ON CONFLICT ("canonicalModelKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "vendor" = EXCLUDED."vendor",
  "unit" = EXCLUDED."unit",
  "netCostYuan" = EXCLUDED."netCostYuan",
  "marginM" = EXCLUDED."marginM",
  "listPriceYuan" = EXCLUDED."listPriceYuan",
  "creditsPerUnit" = EXCLUDED."creditsPerUnit",
  "baseMarginRate" = EXCLUDED."baseMarginRate",
  "formulaSnapshot" = EXCLUDED."formulaSnapshot",
  "active" = true,
  "publishedAt" = CURRENT_TIMESTAMP,
  "publishedBy" = EXCLUDED."publishedBy";
