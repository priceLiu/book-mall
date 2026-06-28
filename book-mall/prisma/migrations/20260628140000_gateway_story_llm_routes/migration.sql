-- Story / Canvas LLM 常用 modelKey 补登记（Gemini 3 / DeepSeek V4）
-- 修复 UnregisteredGatewayModelError: google/gemini-3-flash-preview 等

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
  v.id,
  v.canonical,
  v.vendor,
  v.model_key,
  v.provider::"GatewayProviderKind",
  true,
  v.sort_order,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('cl_gwrt_gemini3_preview', 'gemini-flash', 'kie', 'google/gemini-3-flash-preview', 'KIE', 0),
    ('cl_gwrt_gemini3_flash', 'gemini-flash', 'kie', 'gemini-3-flash', 'KIE', 1),
    ('cl_gwrt_deepseek_v4_flash', 'deepseek-chat', 'deepseek', 'deepseek-v4-flash', 'DEEPSEEK', 0),
    ('cl_gwrt_deepseek_v4_pro', 'deepseek-chat', 'deepseek', 'deepseek-v4-pro', 'DEEPSEEK', 1),
    ('cl_gwrt_deepseek_chat', 'deepseek-chat', 'deepseek', 'deepseek-chat', 'DEEPSEEK', 2)
) AS v(id, canonical, vendor, model_key, provider, sort_order)
WHERE EXISTS (SELECT 1 FROM "ModelCatalog" c WHERE c."canonicalKey" = v.canonical)
ON CONFLICT ("canonicalModelKey", "vendor", "modelKey") DO UPDATE SET
  "active" = true,
  "providerKind" = EXCLUDED."providerKind",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
