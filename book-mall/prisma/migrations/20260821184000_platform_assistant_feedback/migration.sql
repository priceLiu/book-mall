-- AI 小智 · 用户反馈 / Bug / 未能解答问题

CREATE TYPE "PlatformAssistantFeedbackCategory" AS ENUM ('BUG', 'QUESTION', 'FEATURE_REQUEST', 'OTHER');
CREATE TYPE "PlatformAssistantFeedbackStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED');

CREATE TABLE "PlatformAssistantFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PlatformAssistantFeedbackCategory" NOT NULL,
    "status" "PlatformAssistantFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "userMessage" TEXT NOT NULL,
    "assistantReply" TEXT,
    "sourceApp" TEXT,
    "pageUrl" TEXT,
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformAssistantFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAssistantFeedback_status_createdAt_idx" ON "PlatformAssistantFeedback"("status", "createdAt" DESC);
CREATE INDEX "PlatformAssistantFeedback_category_createdAt_idx" ON "PlatformAssistantFeedback"("category", "createdAt" DESC);
CREATE INDEX "PlatformAssistantFeedback_userId_createdAt_idx" ON "PlatformAssistantFeedback"("userId", "createdAt" DESC);

ALTER TABLE "PlatformAssistantFeedback" ADD CONSTRAINT "PlatformAssistantFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
