-- canvas-web AI 海报画布：项目 / 模板 / 任务 / 模型目录 / OSS 清理队列
-- 详见 ../../../../canvas-web/docs/plan.md

-- CreateEnum
CREATE TYPE "CanvasModelRole" AS ENUM ('IMAGE', 'VIDEO', 'LLM');
CREATE TYPE "CanvasGenerationKind" AS ENUM ('IMAGE', 'TEXT');
CREATE TYPE "CanvasGenerationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable: CanvasEngineModel
CREATE TABLE "CanvasEngineModel" (
    "id" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "role" "CanvasModelRole" NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasEngineModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvasProject
CREATE TABLE "CanvasProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "canvas" JSONB NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvasTemplate
CREATE TABLE "CanvasTemplate" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "canvas" JSONB NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvasGenerationTask
CREATE TABLE "CanvasGenerationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "kind" "CanvasGenerationKind" NOT NULL,
    "status" "CanvasGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "kieTaskId" TEXT,
    "inputPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "inputHash" TEXT NOT NULL,
    "ephemeralUrl" TEXT,
    "ossUrl" TEXT,
    "textOutput" TEXT,
    "failCode" TEXT,
    "failMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasGenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvasOssCleanupQueue
CREATE TABLE "CanvasOssCleanupQueue" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "projectId" TEXT,
    "ossUrl" TEXT NOT NULL,
    "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastTriedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasOssCleanupQueue_pkey" PRIMARY KEY ("id")
);

-- Unique & indexes
CREATE UNIQUE INDEX "CanvasEngineModel_modelKey_key" ON "CanvasEngineModel"("modelKey");
CREATE INDEX "CanvasEngineModel_role_active_sortOrder_idx" ON "CanvasEngineModel"("role", "active", "sortOrder");

CREATE INDEX "CanvasProject_userId_deletedAt_updatedAt_idx" ON "CanvasProject"("userId", "deletedAt", "updatedAt");

CREATE INDEX "CanvasTemplate_ownerUserId_sortOrder_idx" ON "CanvasTemplate"("ownerUserId", "sortOrder");
CREATE INDEX "CanvasTemplate_builtin_sortOrder_idx" ON "CanvasTemplate"("builtin", "sortOrder");

CREATE UNIQUE INDEX "CanvasGenerationTask_kieTaskId_key" ON "CanvasGenerationTask"("kieTaskId");
CREATE INDEX "CanvasGenerationTask_status_submittedAt_idx" ON "CanvasGenerationTask"("status", "submittedAt");
CREATE INDEX "CanvasGenerationTask_projectId_nodeId_idx" ON "CanvasGenerationTask"("projectId", "nodeId");
CREATE INDEX "CanvasGenerationTask_projectId_inputHash_idx" ON "CanvasGenerationTask"("projectId", "inputHash");

CREATE INDEX "CanvasOssCleanupQueue_doneAt_notBefore_idx" ON "CanvasOssCleanupQueue"("doneAt", "notBefore");
CREATE INDEX "CanvasOssCleanupQueue_projectId_idx" ON "CanvasOssCleanupQueue"("projectId");

-- ForeignKeys
ALTER TABLE "CanvasProject" ADD CONSTRAINT "CanvasProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasTemplate" ADD CONSTRAINT "CanvasTemplate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasGenerationTask" ADD CONSTRAINT "CanvasGenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CanvasProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasOssCleanupQueue" ADD CONSTRAINT "CanvasOssCleanupQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CanvasProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
