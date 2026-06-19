-- 生成交通式控流：QUEUED/DISPATCHING + GenerationTrafficState

ALTER TYPE "CanvasGenerationStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "CanvasGenerationStatus" ADD VALUE IF NOT EXISTS 'DISPATCHING';
ALTER TYPE "StoryGenerationStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "StoryGenerationStatus" ADD VALUE IF NOT EXISTS 'DISPATCHING';

CREATE TABLE "GenerationTrafficState" (
    "scopeKey" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "runningVideoCount" INTEGER NOT NULL DEFAULT 0,
    "dispatchTokens" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastTokenRefillAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDispatchAt" TIMESTAMP(3),
    "maxConcurrency" INTEGER NOT NULL DEFAULT 2,
    "tokensPerSec" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationTrafficState_pkey" PRIMARY KEY ("scopeKey")
);

CREATE INDEX "GenerationTrafficState_ownerType_ownerId_idx" ON "GenerationTrafficState"("ownerType", "ownerId");

ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "dispatchAfter" TIMESTAMP(3);
ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CanvasGenerationTask" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;

CREATE INDEX IF NOT EXISTS "CanvasGenerationTask_status_queuedAt_idx" ON "CanvasGenerationTask"("status", "queuedAt");

ALTER TABLE "StoryGenerationTask" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
ALTER TABLE "StoryGenerationTask" ADD COLUMN IF NOT EXISTS "dispatchAfter" TIMESTAMP(3);
ALTER TABLE "StoryGenerationTask" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "StoryGenerationTask" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;

CREATE INDEX IF NOT EXISTS "StoryGenerationTask_status_queuedAt_idx" ON "StoryGenerationTask"("status", "queuedAt");
