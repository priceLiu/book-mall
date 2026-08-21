-- AI 小智 · 每日热闻（Cron 预生成）

CREATE TYPE "PlatformAssistantAiNewsStatus" AS ENUM ('READY', 'FAILED');

CREATE TABLE "PlatformAssistantAiNewsDaily" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PlatformAssistantAiNewsStatus" NOT NULL DEFAULT 'READY',
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAssistantAiNewsDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAssistantAiNewsDaily_dateKey_key" ON "PlatformAssistantAiNewsDaily"("dateKey");
CREATE INDEX "PlatformAssistantAiNewsDaily_dateKey_idx" ON "PlatformAssistantAiNewsDaily"("dateKey" DESC);
CREATE INDEX "PlatformAssistantAiNewsDaily_status_generatedAt_idx" ON "PlatformAssistantAiNewsDaily"("status", "generatedAt" DESC);
