-- aitryon-parsing-v1：平台积分报价（按输入 1 张；C=0.0036, M=2.5, U=1 积分）

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
VALUES (
  'seed_aitryon-parsing-v1_aliyun',
  'aitryon-parsing-v1',
  'aliyun',
  'CHANNEL',
  'PER_IMAGE',
  NULL,
  0.004,
  0.1,
  0.0036,
  true,
  'migration:20260714200000_aitryon_parsing_credit_price',
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
VALUES (
  'mcp_aitryon_parsing_v1',
  'aitryon-parsing-v1',
  'AI 试衣-图片分割',
  'aliyun',
  'PER_IMAGE',
  NULL,
  0.0036,
  2.5,
  0.009,
  1,
  0.91,
  '{"source":"migration:20260714200000","listCostYuan":0.004,"discountRate":0.1,"netCostYuan":0.0036,"marginM":2.5,"listPriceYuan":0.009,"creditsPerUnit":1,"anchorYuan":0.04}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  'migration:20260714200000'
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
