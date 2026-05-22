-- story-web 三期：AI 创作生产线
-- 详见 ../../../../story-web/docs/ai/plan.md §2 与 doc/database/schema-changelog.md

-- CreateEnum
CREATE TYPE "StoryProjectAspect" AS ENUM ('RATIO_16_9', 'RATIO_9_16');
CREATE TYPE "StoryProjectStatus" AS ENUM ('DRAFT', 'INITIALIZING', 'READY', 'ARCHIVED');
CREATE TYPE "StoryGenerationKind" AS ENUM ('COVER_IMAGE', 'CHARACTER_AVATAR', 'FRAME_IMAGE', 'FRAME_VIDEO');
CREATE TYPE "StoryGenerationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StoryProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aspectRatio" "StoryProjectAspect" NOT NULL,
    "styleId" INTEGER NOT NULL,
    "storyOutline" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT NOT NULL DEFAULT '',
    "coverTaskId" TEXT,
    "status" "StoryProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryCharacter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "avatarTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryCharacter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryStoryboardFrame" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "sceneText" TEXT NOT NULL DEFAULT '',
    "sceneDescription" TEXT NOT NULL DEFAULT '',
    "characterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imagePrompt" TEXT NOT NULL,
    "videoPrompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imageTaskId" TEXT,
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "videoTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryStoryboardFrame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryGenerationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "characterId" TEXT,
    "frameId" TEXT,
    "kind" "StoryGenerationKind" NOT NULL,
    "status" "StoryGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "kieTaskId" TEXT,
    "inputPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "ephemeralUrl" TEXT,
    "ossUrl" TEXT,
    "failCode" TEXT,
    "failMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryGenerationTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryOssCleanupQueue" (
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

    CONSTRAINT "StoryOssCleanupQueue_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "StoryProject_userId_deletedAt_updatedAt_idx" ON "StoryProject"("userId", "deletedAt", "updatedAt");
CREATE INDEX "StoryProject_status_idx" ON "StoryProject"("status");

CREATE INDEX "StoryCharacter_projectId_sortOrder_idx" ON "StoryCharacter"("projectId", "sortOrder");

CREATE INDEX "StoryStoryboardFrame_projectId_idx" ON "StoryStoryboardFrame"("projectId");
CREATE UNIQUE INDEX "StoryStoryboardFrame_projectId_index_key" ON "StoryStoryboardFrame"("projectId", "index");

CREATE UNIQUE INDEX "StoryGenerationTask_kieTaskId_key" ON "StoryGenerationTask"("kieTaskId");
CREATE INDEX "StoryGenerationTask_status_submittedAt_idx" ON "StoryGenerationTask"("status", "submittedAt");
CREATE INDEX "StoryGenerationTask_projectId_kind_idx" ON "StoryGenerationTask"("projectId", "kind");
CREATE INDEX "StoryGenerationTask_characterId_idx" ON "StoryGenerationTask"("characterId");
CREATE INDEX "StoryGenerationTask_frameId_idx" ON "StoryGenerationTask"("frameId");

CREATE INDEX "StoryOssCleanupQueue_doneAt_notBefore_idx" ON "StoryOssCleanupQueue"("doneAt", "notBefore");
CREATE INDEX "StoryOssCleanupQueue_projectId_idx" ON "StoryOssCleanupQueue"("projectId");

-- ForeignKeys
ALTER TABLE "StoryProject" ADD CONSTRAINT "StoryProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCharacter" ADD CONSTRAINT "StoryCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryStoryboardFrame" ADD CONSTRAINT "StoryStoryboardFrame_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryGenerationTask" ADD CONSTRAINT "StoryGenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryOssCleanupQueue" ADD CONSTRAINT "StoryOssCleanupQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
