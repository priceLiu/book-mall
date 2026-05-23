-- canvas v2: 用户级 Provider 体系
-- 详见 canvas-web/docs/plan-v2.md

-- CreateEnum
CREATE TYPE "CanvasProviderKind" AS ENUM ('KIE', 'ALI_BAILIAN', 'OPENAI_COMPAT', 'GEMINI_NATIVE');

-- CreateTable: CanvasProvider
CREATE TABLE "CanvasProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "kind" "CanvasProviderKind" NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "baseUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasProvider_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CanvasProvider_userId_active_idx" ON "CanvasProvider"("userId", "active");

ALTER TABLE "CanvasProvider"
  ADD CONSTRAINT "CanvasProvider_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: CanvasProviderModel
CREATE TABLE "CanvasProviderModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "CanvasModelRole" NOT NULL,
    "description" TEXT,
    "paramsSchema" JSONB,
    "defaultParams" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasProviderModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvasProviderModel_providerId_modelKey_key"
  ON "CanvasProviderModel"("providerId", "modelKey");
CREATE INDEX "CanvasProviderModel_providerId_enabled_sortOrder_idx"
  ON "CanvasProviderModel"("providerId", "enabled", "sortOrder");
CREATE INDEX "CanvasProviderModel_role_idx" ON "CanvasProviderModel"("role");

ALTER TABLE "CanvasProviderModel"
  ADD CONSTRAINT "CanvasProviderModel_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "CanvasProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: CanvasGenerationTask 加 providerId + deletedAt + 索引
ALTER TABLE "CanvasGenerationTask" ADD COLUMN "providerId" TEXT;
ALTER TABLE "CanvasGenerationTask" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "CanvasGenerationTask_providerId_idx"
  ON "CanvasGenerationTask"("providerId");
CREATE INDEX "CanvasGenerationTask_projectId_nodeId_deletedAt_createdAt_idx"
  ON "CanvasGenerationTask"("projectId", "nodeId", "deletedAt", "createdAt");

ALTER TABLE "CanvasGenerationTask"
  ADD CONSTRAINT "CanvasGenerationTask_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "CanvasProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
