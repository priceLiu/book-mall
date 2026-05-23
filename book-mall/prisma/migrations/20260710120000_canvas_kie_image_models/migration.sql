-- canvas · 新增 KIE 文生图模型；下线不可用的 kling-image

UPDATE "CanvasEngineModel"
SET "active" = false, "updatedAt" = NOW()
WHERE "modelKey" = 'kling-image';

INSERT INTO "CanvasEngineModel" (
  "id", "modelKey", "displayName", "vendor", "role", "description", "defaultParams", "active", "sortOrder", "createdAt", "updatedAt"
) VALUES
  (
    gen_random_uuid()::text,
    'seedream-5-lite',
    'Seedream 5.0 Lite',
    'bytedance/seedream',
    'IMAGE',
    'Seedream 5 Lite 写实文生图。',
    '{"aspect_ratio":"1:1","quality":"basic"}'::jsonb,
    true,
    10,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'seedream-4.5',
    'Seedream 4.5',
    'bytedance/seedream',
    'IMAGE',
    'Seedream 4.5 高质量写实文生图。',
    '{"aspect_ratio":"1:1","quality":"basic"}'::jsonb,
    true,
    11,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'gpt-image-2',
    'GPT Image 2',
    'openai',
    'IMAGE',
    'GPT Image 2 · 海报 / 排版。',
    '{"aspect_ratio":"1:1","resolution":"2K"}'::jsonb,
    true,
    12,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'qwen-text-to-image',
    'Qwen 文生图',
    'alibaba/qwen',
    'IMAGE',
    '通义 Qwen 写实文生图。',
    '{"aspect_ratio":"1:1","output_format":"png"}'::jsonb,
    true,
    13,
    NOW(),
    NOW()
  )
ON CONFLICT ("modelKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "vendor" = EXCLUDED."vendor",
  "description" = EXCLUDED."description",
  "defaultParams" = EXCLUDED."defaultParams",
  "active" = EXCLUDED."active",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();

UPDATE "CanvasEngineModel"
SET
  "displayName" = 'GPT Image 1.5',
  "description" = 'GPT Image 1.5 · 排版 / 平面海报。',
  "defaultParams" = '{"aspect_ratio":"1:1","quality":"medium"}'::jsonb,
  "updatedAt" = NOW()
WHERE "modelKey" = 'gpt-image-1';
