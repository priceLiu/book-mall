-- canvas · KIE Flux-2 Pro 文生图

INSERT INTO "CanvasEngineModel" (
  "id", "modelKey", "displayName", "vendor", "role", "description", "defaultParams", "active", "sortOrder", "createdAt", "updatedAt"
) VALUES
  (
    gen_random_uuid()::text,
    'flux-2-pro',
    'Flux-2 Pro',
    'black-forest-labs/flux-2',
    'IMAGE',
    'Flux-2 Pro 高质量写实文生图。',
    '{"aspect_ratio":"1:1","resolution":"2K"}'::jsonb,
    true,
    9,
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
