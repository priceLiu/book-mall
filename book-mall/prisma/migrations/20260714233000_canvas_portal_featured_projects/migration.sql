-- 门户首页精选示例项目（方案 C）
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalFeaturedSort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalFeaturedBlurb" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "CanvasProject_portalFeatured_portalFeaturedSort_idx"
  ON "CanvasProject" ("portalFeatured", "portalFeaturedSort");
