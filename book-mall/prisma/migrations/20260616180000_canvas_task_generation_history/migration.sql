-- AlterTable
ALTER TABLE "CanvasGenerationTask" ADD COLUMN "canvasHistoryId" TEXT;

-- AddForeignKey
ALTER TABLE "CanvasGenerationTask" ADD CONSTRAINT "CanvasGenerationTask_canvasHistoryId_fkey" FOREIGN KEY ("canvasHistoryId") REFERENCES "CanvasProjectHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CanvasGenerationTask_canvasHistoryId_idx" ON "CanvasGenerationTask"("canvasHistoryId");
