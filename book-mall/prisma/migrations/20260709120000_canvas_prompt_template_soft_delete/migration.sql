-- 提示词模板软删除（归档快照）；活跃模板 LLM+IMAGE 合计配额由应用层限制为 8

ALTER TABLE "CanvasPromptTemplate" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "CanvasPromptTemplate_userId_deletedAt_idx" ON "CanvasPromptTemplate"("userId", "deletedAt");
