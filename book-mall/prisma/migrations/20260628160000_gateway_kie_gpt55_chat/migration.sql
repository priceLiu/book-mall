-- Gateway · KIE GPT-5.5 Chat（剧本节点 LLM 可选）

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
    ('cl_gwrt_gpt55_chat', 'gpt-5-5-chat', 'kie', 'gpt-5-5', 'KIE', 0)
) AS v(id, canonical, vendor, model_key, provider, sort_order)
WHERE EXISTS (SELECT 1 FROM "ModelCatalog" c WHERE c."canonicalKey" = v.canonical)
ON CONFLICT ("canonicalModelKey", "vendor", "modelKey") DO UPDATE SET
  "active" = true,
  "providerKind" = EXCLUDED."providerKind",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
