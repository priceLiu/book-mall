-- 「我的提示词」归档列 + 列表索引（避免按 mediaKind 应用层扫描）
ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "archivePromptText" TEXT;
ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "archiveMediaKind" TEXT;

CREATE INDEX IF NOT EXISTS "CanvasGenerationTask_project_prompt_archive_idx"
  ON "CanvasGenerationTask" ("projectId", "deletedAt", "status", "archiveMediaKind", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "CanvasGenerationTask_actor_prompt_archive_idx"
  ON "CanvasGenerationTask" ("actorUserId", "deletedAt", "status", "archiveMediaKind", "createdAt" DESC);
