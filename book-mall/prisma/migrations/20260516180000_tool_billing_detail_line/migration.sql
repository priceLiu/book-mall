-- CreateEnum
CREATE TYPE "ToolBillingDetailSource" AS ENUM ('CLOUD_CSV_IMPORT', 'TOOL_USAGE_GENERATED');

-- CreateTable
CREATE TABLE "ToolBillingDetailLine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolUsageEventId" TEXT,
    "source" "ToolBillingDetailSource" NOT NULL DEFAULT 'CLOUD_CSV_IMPORT',
    "cloudRow" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolBillingDetailLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolBillingDetailLine_userId_createdAt_idx" ON "ToolBillingDetailLine"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolBillingDetailLine_toolUsageEventId_idx" ON "ToolBillingDetailLine"("toolUsageEventId");

-- AddForeignKey
ALTER TABLE "ToolBillingDetailLine" ADD CONSTRAINT "ToolBillingDetailLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ToolBillingDetailLine" ADD CONSTRAINT "ToolBillingDetailLine_toolUsageEventId_fkey" FOREIGN KEY ("toolUsageEventId") REFERENCES "ToolUsageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
