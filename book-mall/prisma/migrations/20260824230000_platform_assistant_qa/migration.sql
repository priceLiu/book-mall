-- AI 小智 · 管理员问答库
CREATE TYPE "PlatformAssistantQaMatchMode" AS ENUM ('EXACT', 'CONTAINS', 'KEYWORDS');

CREATE TABLE "PlatformAssistantQaEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "matchMode" "PlatformAssistantQaMatchMode" NOT NULL DEFAULT 'CONTAINS',
    "matchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceFeedbackId" TEXT,
    "updatedByUserId" TEXT,
    "adminNote" TEXT,

    CONSTRAINT "PlatformAssistantQaEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAssistantQaEntry_enabled_sortOrder_updatedAt_idx" ON "PlatformAssistantQaEntry"("enabled", "sortOrder" DESC, "updatedAt" DESC);
