-- 分镜视频 1.0 · 门户「影视案例」独立标记（与 Pro2 案例墙 portalCase 分离）
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalFilmCase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalFilmCaseSort" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CanvasProject_portalFilmCase_portalFilmCaseSort_idx"
  ON "CanvasProject" ("portalFilmCase", "portalFilmCaseSort");
