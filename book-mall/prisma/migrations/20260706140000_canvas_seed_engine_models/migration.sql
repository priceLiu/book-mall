-- 画布内置三套图像模型种子（首批）。后续 admin UI 可继续增删改。
-- 使用 ON CONFLICT 去重，确保此迁移可重放。

INSERT INTO "CanvasEngineModel" (
  "id", "modelKey", "displayName", "vendor", "role", "description", "defaultParams", "active", "sortOrder", "createdAt", "updatedAt"
) VALUES
  (
    gen_random_uuid()::text,
    'nano-banana-pro',
    'Nano Banana Pro',
    'google/nano-banana',
    'IMAGE',
    '通用图像生成 / 风格融合，支持多张参考图，画风稳定。',
    '{"aspect_ratio":"1:1","resolution":"2K","output_format":"png"}'::jsonb,
    true,
    1,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'gpt-image-1',
    'GPT Image 1',
    'openai',
    'IMAGE',
    'OpenAI 通用图像，适合排版 / 平面海报 / 图标。',
    '{"size":"1024x1024","quality":"high"}'::jsonb,
    true,
    2,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid()::text,
    'kling-image',
    'Kling Image',
    'kuaishou/kling',
    'IMAGE',
    '可灵 · 偏写实人像与场景；多图融合体感佳。',
    '{"aspect_ratio":"1:1"}'::jsonb,
    true,
    3,
    NOW(),
    NOW()
  )
ON CONFLICT ("modelKey") DO NOTHING;
