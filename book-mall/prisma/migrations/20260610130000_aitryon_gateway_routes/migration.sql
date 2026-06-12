-- AI 试衣成片模型 aitryon / aitryon-plus / aitryon-refiner 补全 GatewayModelRoute
-- 修复 UnregisteredGatewayModelError: 模型未在 Gateway 注册：aitryon

UPDATE "ModelCatalog"
SET
  "requestKind" = 'TRYON'::"GatewayRequestKind",
  "role" = 'IMAGE'::"CanvasModelRole",
  "mediaKind" = 'TEXT_TO_IMAGE'::"ModelMediaKind",
  "appTags" = ARRAY['tool', 'canvas', 'story', 'ecom']::TEXT[],
  "gatewayPublished" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "canonicalKey" IN ('aitryon', 'aitryon-plus', 'aitryon-refiner');

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
    'gmr_aitryon_aliyun',
    'aitryon',
    'aliyun',
    'aitryon',
    'DASHSCOPE'::"GatewayProviderKind",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'gmr_aitryon_plus_aliyun',
    'aitryon-plus',
    'aliyun',
    'aitryon-plus',
    'DASHSCOPE'::"GatewayProviderKind",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'gmr_aitryon_refiner_aliyun',
    'aitryon-refiner',
    'aliyun',
    'aitryon-refiner',
    'DASHSCOPE'::"GatewayProviderKind",
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
