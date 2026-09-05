-- Gateway · 百炼 Qwen3.8-Max · 视觉理解默认 · 平台代付
-- 价目：docs/price/ali.md · 输入 12 元/M tokens · 输出 36 元/M tokens

INSERT INTO "ModelCatalog" (
  "id",
  "canonicalKey",
  "displayName",
  "vendor",
  "billingKind",
  "unitLabel",
  "active",
  "note",
  "requestKind",
  "role",
  "mediaKind",
  "appTags",
  "gatewayPublished",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'cl_qwen38_max',
    'qwen3.8-max',
    'Qwen3.8-Max',
    'aliyun',
    'TOKEN_IN_OUT'::"PricingBillingKind",
    '元/百万 tokens',
    true,
    '百炼 · 旗舰 · 视频/图片理解 · 全站视觉理解默认（输入 12 / 输出 36 元/M tokens）',
    'CHAT'::"GatewayRequestKind",
    'LLM'::"CanvasModelRole",
    'TEXT_LLM'::"ModelMediaKind",
    ARRAY['canvas', 'story', 'tool', 'ecom', 'visual-lab', 'prompt-optimizer']::TEXT[],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("canonicalKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "vendor" = EXCLUDED."vendor",
  "billingKind" = EXCLUDED."billingKind",
  "unitLabel" = EXCLUDED."unitLabel",
  "note" = EXCLUDED."note",
  "requestKind" = EXCLUDED."requestKind",
  "role" = EXCLUDED."role",
  "mediaKind" = EXCLUDED."mediaKind",
  "appTags" = EXCLUDED."appTags",
  "gatewayPublished" = true,
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "GatewayModelRoute" (
  "id",
  "canonicalModelKey",
  "vendor",
  "modelKey",
  "providerKind",
  "active",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'gmr_qwen38_max_bailian',
    'qwen3.8-max',
    'aliyun',
    'qwen3.8-max',
    'BAILIAN'::"GatewayProviderKind",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("canonicalModelKey", "vendor", "modelKey") DO UPDATE SET
  "providerKind" = EXCLUDED."providerKind",
  "active" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ModelCostProfile" (
  "id",
  "vendor",
  "canonicalModelKey",
  "channel",
  "unit",
  "tierRaw",
  "listCostYuan",
  "inputListCostYuan",
  "outputListCostYuan",
  "discountRate",
  "netCostYuan",
  "active",
  "note",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'seed_qwen3.8-max_aliyun',
    'aliyun',
    'qwen3.8-max',
    'CHANNEL'::"CreditChannel",
    'PER_KTOKEN'::"CreditCostUnit",
    '0<Token≤1M',
    0.012,
    0.012,
    0.036,
    0.1,
    0.0108,
    true,
    'docs/price/ali.md · 输入 12 元/M · 输出 36 元/M',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "listCostYuan" = EXCLUDED."listCostYuan",
  "inputListCostYuan" = EXCLUDED."inputListCostYuan",
  "outputListCostYuan" = EXCLUDED."outputListCostYuan",
  "discountRate" = EXCLUDED."discountRate",
  "netCostYuan" = EXCLUDED."netCostYuan",
  "tierRaw" = EXCLUDED."tierRaw",
  "note" = EXCLUDED."note",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
