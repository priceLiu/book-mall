-- poll worker 按 status + lastPolledAt 扫描 SUBMITTED 任务
CREATE INDEX "CanvasGenerationTask_status_lastPolledAt_idx"
  ON "CanvasGenerationTask"("status", "lastPolledAt");

CREATE INDEX "StoryGenerationTask_status_lastPolledAt_idx"
  ON "StoryGenerationTask"("status", "lastPolledAt");
