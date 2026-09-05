-- Gateway · 百炼 Qwen3 ASR 文件转写（自动剪辑烧字幕）

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
    'cl_qwen3_asr_flash_filetrans',
    'qwen3-asr-flash-filetrans',
    'Qwen3 ASR · 文件转写',
    'aliyun',
    'TOKEN_IN_OUT'::"PricingBillingKind",
    '元/秒',
    true,
    '百炼 DashScope 录音文件异步转写 · 自动剪辑 ASR 烧字幕',
    'OTHER'::"GatewayRequestKind",
    'LLM'::"CanvasModelRole",
    'TEXT_LLM'::"ModelMediaKind",
    ARRAY['canvas', 'book-mall']::TEXT[],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("canonicalKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "note" = EXCLUDED."note",
  "requestKind" = EXCLUDED."requestKind",
  "gatewayPublished" = true,
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
SELECT
  'gmr_qwen3_asr_flash_filetrans_aliyun',
  'qwen3-asr-flash-filetrans',
  'aliyun',
  'qwen3-asr-flash-filetrans',
  'DASHSCOPE'::"GatewayProviderKind",
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "ModelCatalog" WHERE "canonicalKey" = 'qwen3-asr-flash-filetrans'
)
ON CONFLICT ("canonicalModelKey", "vendor", "modelKey") DO UPDATE SET
  "providerKind" = EXCLUDED."providerKind",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
