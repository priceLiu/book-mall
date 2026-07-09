-- Gateway · 火山方舟 Doubao Seed 2.1 Pro · 多模态视觉理解

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
    'cl_doubao_seed_21_pro_vision',
    'doubao-seed-2.1-pro',
    'Doubao Seed 2.1 Pro · 视觉理解',
    'volcengine',
    'TOKEN_IN_OUT'::"PricingBillingKind",
    '元/百万 tokens',
    true,
    '火山方舟 · 多模态图片理解 · 画布文本节点反推提示词（上游 doubao-seed-2-1-pro-260628）',
    'CHAT'::"GatewayRequestKind",
    'LLM'::"CanvasModelRole",
    'TEXT_LLM'::"ModelMediaKind",
    ARRAY['canvas', 'story', 'tool', 'ecom', 'prompt-optimizer']::TEXT[],
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
    'gmr_doubao_seed_21_pro_volc',
    'doubao-seed-2.1-pro',
    'volcengine',
    'doubao-seed-2.1-pro',
    'VOLCENGINE'::"GatewayProviderKind",
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
