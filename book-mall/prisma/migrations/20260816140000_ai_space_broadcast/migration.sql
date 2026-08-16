-- CreateTable
CREATE TABLE "AiSpaceBroadcastProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '未命名口播项目',
    "sourceKind" TEXT NOT NULL DEFAULT 'text',
    "sourceText" TEXT,
    "sourceAudioAssetId" TEXT,
    "brief" JSONB NOT NULL DEFAULT '{}',
    "targetDurationSec" INTEGER,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "activeScriptId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceBroadcastProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSpaceBroadcastScript" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "llmMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSpaceBroadcastScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSpaceBroadcastShot" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voiceoverText" TEXT NOT NULL,
    "sceneDescription" TEXT NOT NULL DEFAULT '',
    "presenter" JSONB NOT NULL DEFAULT '{}',
    "visual" JSONB NOT NULL DEFAULT '{}',
    "audioAssetId" TEXT,
    "backgroundVideoId" TEXT,
    "digitalHumanId" TEXT,
    "shotStatus" TEXT NOT NULL DEFAULT 'draft',
    "composeTaskId" TEXT,
    "outputVideoUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceBroadcastShot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSpaceBroadcastRenderJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "finalVideoUrl" TEXT,
    "errorMessage" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceBroadcastRenderJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiSpaceBroadcastProject_userId_updatedAt_idx" ON "AiSpaceBroadcastProject"("userId", "updatedAt");

CREATE UNIQUE INDEX "AiSpaceBroadcastScript_projectId_version_key" ON "AiSpaceBroadcastScript"("projectId", "version");
CREATE INDEX "AiSpaceBroadcastScript_projectId_createdAt_idx" ON "AiSpaceBroadcastScript"("projectId", "createdAt");

CREATE UNIQUE INDEX "AiSpaceBroadcastShot_scriptId_index_key" ON "AiSpaceBroadcastShot"("scriptId", "index");
CREATE INDEX "AiSpaceBroadcastShot_scriptId_index_idx" ON "AiSpaceBroadcastShot"("scriptId", "index");

CREATE INDEX "AiSpaceBroadcastRenderJob_projectId_createdAt_idx" ON "AiSpaceBroadcastRenderJob"("projectId", "createdAt");

ALTER TABLE "AiSpaceBroadcastProject" ADD CONSTRAINT "AiSpaceBroadcastProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSpaceBroadcastScript" ADD CONSTRAINT "AiSpaceBroadcastScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiSpaceBroadcastProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSpaceBroadcastShot" ADD CONSTRAINT "AiSpaceBroadcastShot_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "AiSpaceBroadcastScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSpaceBroadcastRenderJob" ADD CONSTRAINT "AiSpaceBroadcastRenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiSpaceBroadcastProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
