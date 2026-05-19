-- v1.0.0 AI 试衣四模型：ModelCatalog + ModelAlias（阿里云百炼）
-- 需求：doc/product/11-ai-tryon-cost-template-v1.0.md

-- 1) ModelCatalog（canonicalKey 冲突则更新展示字段，不删已有 id）
INSERT INTO "ModelCatalog" (
  "id",
  "canonicalKey",
  "displayName",
  "vendor",
  "defaultTierRaw",
  "billingKind",
  "unitLabel",
  "active",
  "note",
  "vendorProductName",
  "vendorCommodityCode",
  "vendorCommodityName",
  "vendorBillableItemCode",
  "vendorBillableItemName",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'cl_tryon_cat_aitryon',
    'aitryon',
    'AI 试衣-基础版',
    'aliyun',
    NULL,
    'OUTPUT_IMAGE',
    '元/张',
    true,
    '百炼 aitryon；挂牌 0.20 元/张（输出）；需求 v1.0.0',
    '大模型服务平台百炼',
    'sfm_inference_public_cn',
    '百炼大模型推理',
    'image_number',
    '大模型图片生成量',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cl_tryon_cat_aitryon_plus',
    'aitryon-plus',
    'AI 试衣-Plus 版',
    'aliyun',
    NULL,
    'OUTPUT_IMAGE',
    '元/张',
    true,
    '百炼 aitryon-plus；挂牌 0.50 元/张（输出）；需求 v1.0.0',
    '大模型服务平台百炼',
    'sfm_inference_public_cn',
    '百炼大模型推理',
    'image_number',
    '大模型图片生成量',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cl_tryon_cat_aitryon_parsing',
    'aitryon-parsing-v1',
    'AI 试衣-图片分割',
    'aliyun',
    NULL,
    'COST_PER_IMAGE',
    '元/张（输入）',
    true,
    '百炼 aitryon-parsing-v1；挂牌 0.004 元/张（输入）；需求 v1.0.0',
    '大模型服务平台百炼',
    'sfm_inference_public_cn',
    '百炼大模型推理',
    'image_number',
    '大模型图片生成量',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cl_tryon_cat_aitryon_refiner',
    'aitryon-refiner',
    'AI 试衣-图片精修',
    'aliyun',
    NULL,
    'OUTPUT_IMAGE',
    '元/张',
    true,
    '百炼 aitryon-refiner；挂牌阶梯价（输出累计分档）；需求 v1.0.0',
    '大模型服务平台百炼',
    'sfm_inference_public_cn',
    '百炼大模型推理',
    'image_number',
    '大模型图片生成量',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("canonicalKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "vendor" = EXCLUDED."vendor",
  "billingKind" = EXCLUDED."billingKind",
  "unitLabel" = EXCLUDED."unitLabel",
  "active" = EXCLUDED."active",
  "note" = EXCLUDED."note",
  "vendorProductName" = EXCLUDED."vendorProductName",
  "vendorCommodityCode" = EXCLUDED."vendorCommodityCode",
  "vendorCommodityName" = EXCLUDED."vendorCommodityName",
  "vendorBillableItemCode" = EXCLUDED."vendorBillableItemCode",
  "vendorBillableItemName" = EXCLUDED."vendorBillableItemName",
  "updatedAt" = CURRENT_TIMESTAMP;

-- 2) ModelAlias：scheme A 模型 id → catalog（按 canonicalKey 绑定，避免硬编码 catalog id）
INSERT INTO "ModelAlias" (
  "id",
  "catalogId",
  "source",
  "aliasValue",
  "tierRawHint",
  "confidence",
  "matchedBy",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  v.alias_id,
  c."id",
  'INTERNAL_SCHEME_A_MODEL'::"ModelAliasSource",
  v.alias_value,
  NULL,
  'MANUAL'::"AliasConfidence",
  'migration:20260519120000',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('cl_tryon_alias_aitryon', 'aitryon', 'aitryon'),
    ('cl_tryon_alias_aitryon_plus', 'aitryon-plus', 'aitryon-plus'),
    ('cl_tryon_alias_aitryon_parsing', 'aitryon-parsing-v1', 'aitryon-parsing-v1'),
    ('cl_tryon_alias_aitryon_refiner', 'aitryon-refiner', 'aitryon-refiner')
) AS v(alias_id, alias_value, canonical_key)
JOIN "ModelCatalog" c ON c."canonicalKey" = v.canonical_key
ON CONFLICT ("source", "aliasValue") DO UPDATE SET
  "catalogId" = EXCLUDED."catalogId",
  "active" = true,
  "confidence" = 'MANUAL'::"AliasConfidence",
  "matchedBy" = 'migration:20260519120000',
  "updatedAt" = CURRENT_TIMESTAMP;
