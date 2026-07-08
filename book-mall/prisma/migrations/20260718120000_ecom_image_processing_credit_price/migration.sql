-- 电商图像处理：Qwen 修图 + Seedream 5.0 Lite 平台积分成本档（挂牌价由 seed 脚本发布）

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
VALUES
  (
    'seed_ecom_imgproc_qwen-image-edit',
    'qwen-image-edit',
    'aliyun',
    'CHANNEL',
    'PER_IMAGE',
    NULL,
    0.14,
    0.1,
    0.126,
    true,
    'migration:20260718120000_ecom_image_processing_credit_price',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_ecom_imgproc_qwen-image-edit-max',
    'qwen-image-edit-max',
    'aliyun',
    'CHANNEL',
    'PER_IMAGE',
    NULL,
    0.28,
    0.1,
    0.252,
    true,
    'migration:20260718120000_ecom_image_processing_credit_price',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_ecom_imgproc_doubao-seedream-5-0-lite',
    'doubao-seedream-5-0-lite',
    'volcengine',
    'CHANNEL',
    'PER_IMAGE',
    NULL,
    0.25,
    0.05,
    0.2375,
    true,
    'migration:20260718120000_ecom_image_processing_credit_price',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "listCostYuan" = EXCLUDED."listCostYuan",
  "discountRate" = EXCLUDED."discountRate",
  "netCostYuan" = EXCLUDED."netCostYuan",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
