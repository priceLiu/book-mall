-- CanvasTemplate · 公开分享 / Featured / 元数据
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "edition" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "forkCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CanvasTemplate" ADD COLUMN IF NOT EXISTS "sourceLabel" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "CanvasTemplate_visibility_featured_sortOrder_idx"
  ON "CanvasTemplate"("visibility", "featured", "sortOrder");
