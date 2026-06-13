-- CreateTable
CREATE TABLE "CanvasProjectHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'autosave',
    "canvas" JSONB NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasProjectHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasProjectHistory_userId_projectId_createdAt_idx" ON "CanvasProjectHistory"("userId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CanvasProjectHistory_projectId_createdAt_idx" ON "CanvasProjectHistory"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "CanvasProjectHistory" ADD CONSTRAINT "CanvasProjectHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasProjectHistory" ADD CONSTRAINT "CanvasProjectHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CanvasProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
