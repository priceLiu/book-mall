-- 私域/真人人像库 · Gateway 模型注册（portrait:virtual / portrait:real）
-- 修复 UnregisteredGatewayModelError: 模型未在 Gateway 注册：portrait:virtual

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
    'cl_portrait_virtual',
    'portrait-virtual',
    '私域虚拟人像库',
    'volcengine',
    'COST_PER_IMAGE'::"PricingBillingKind",
    '元/次',
    true,
    '火山方舟 Assets API · 虚拟人像 CreateAsset / asset:// 引用',
    'OTHER'::"GatewayRequestKind",
    'IMAGE'::"CanvasModelRole",
    'TEXT_TO_IMAGE'::"ModelMediaKind",
    ARRAY['canvas', 'story']::TEXT[],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cl_portrait_real',
    'portrait-real',
    '真人人像库',
    'volcengine',
    'COST_PER_IMAGE'::"PricingBillingKind",
    '元/次',
    true,
    '火山方舟 Assets API · 真人 H5 活体 / CreateAsset',
    'OTHER'::"GatewayRequestKind",
    'IMAGE'::"CanvasModelRole",
    'TEXT_TO_IMAGE'::"ModelMediaKind",
    ARRAY['canvas', 'story']::TEXT[],
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
    'gmr_portrait_virtual_volc',
    'portrait-virtual',
    'volcengine',
    'portrait:virtual',
    'VOLCENGINE'::"GatewayProviderKind",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'gmr_portrait_real_volc',
    'portrait-real',
    'volcengine',
    'portrait:real',
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
