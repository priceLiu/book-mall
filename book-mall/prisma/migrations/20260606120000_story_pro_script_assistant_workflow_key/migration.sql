-- 剧本创作助手：按工作流隔离历史（workflowKey = scriptHubId 或 starter:{id}；空串保留旧项目级数据）
ALTER TABLE "StoryProScriptAssistantHistory" ADD COLUMN "workflowKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoryProScriptAssistantHistory" ADD COLUMN "theme" TEXT;

DROP INDEX "StoryProScriptAssistantHistory_userId_projectId_key";

CREATE UNIQUE INDEX "StoryProScriptAssistantHistory_userId_projectId_workflowKey_key"
  ON "StoryProScriptAssistantHistory"("userId", "projectId", "workflowKey");
