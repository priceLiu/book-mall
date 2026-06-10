-- 角色资产「全身 → 服装 AI 分割」依赖 aitryon-parsing-v1 走 Gateway 注册表校验

UPDATE "ModelCatalog"
SET
  "requestKind" = 'TRYON'::"GatewayRequestKind",
  "role" = 'IMAGE'::"CanvasModelRole",
  "mediaKind" = 'TEXT_TO_IMAGE'::"ModelMediaKind",
  "appTags" = ARRAY['canvas', 'tool', 'story', 'ecom']::TEXT[],
  "gatewayPublished" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "canonicalKey" = 'aitryon-parsing-v1';

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
SELECT
  'gmr_aitryon_parsing_v1_aliyun',
  'aitryon-parsing-v1',
  'aliyun',
  'aitryon-parsing-v1',
  'DASHSCOPE'::"GatewayProviderKind",
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "ModelCatalog" WHERE "canonicalKey" = 'aitryon-parsing-v1')
ON CONFLICT ("canonicalModelKey", "vendor", "modelKey") DO UPDATE SET
  "providerKind" = EXCLUDED."providerKind",
  "active" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
