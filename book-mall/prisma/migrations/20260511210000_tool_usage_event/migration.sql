-- CreateTable
CREATE TABLE "ToolUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'page_view',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolUsageEvent_userId_toolKey_createdAt_idx" ON "ToolUsageEvent"("userId", "toolKey", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUsageEvent_toolKey_createdAt_idx" ON "ToolUsageEvent"("toolKey", "createdAt");

-- AddForeignKey
ALTER TABLE "ToolUsageEvent" ADD CONSTRAINT "ToolUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
