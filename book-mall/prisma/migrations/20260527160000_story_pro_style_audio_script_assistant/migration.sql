-- 全局风格 / 角色音频 / 剧本创作助手历史
CREATE TABLE "StoryProStyleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "profileKey" TEXT NOT NULL DEFAULT 'default',
    "displayName" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mainStyle" TEXT,
    "colorTone" TEXT,
    "renderQuality" TEXT,
    "anchorZh" TEXT,
    "anchorEn" TEXT,
    "negativePrompt" TEXT,
    "refImageUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProStyleProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryProCharacterAudioAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "projectId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voiceLabel" TEXT,
    "voiceId" TEXT,
    "sampleOssUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProCharacterAudioAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryProScriptAssistantHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProScriptAssistantHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryProStyleProfile_userId_projectId_profileKey_key" ON "StoryProStyleProfile"("userId", "projectId", "profileKey");
CREATE INDEX "StoryProStyleProfile_userId_updatedAt_idx" ON "StoryProStyleProfile"("userId", "updatedAt");

CREATE UNIQUE INDEX "StoryProCharacterAudioAsset_userId_characterKey_projectId_key" ON "StoryProCharacterAudioAsset"("userId", "characterKey", "projectId");
CREATE INDEX "StoryProCharacterAudioAsset_userId_updatedAt_idx" ON "StoryProCharacterAudioAsset"("userId", "updatedAt");

CREATE UNIQUE INDEX "StoryProScriptAssistantHistory_userId_projectId_key" ON "StoryProScriptAssistantHistory"("userId", "projectId");
CREATE INDEX "StoryProScriptAssistantHistory_userId_updatedAt_idx" ON "StoryProScriptAssistantHistory"("userId", "updatedAt");

ALTER TABLE "StoryProStyleProfile" ADD CONSTRAINT "StoryProStyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProCharacterAudioAsset" ADD CONSTRAINT "StoryProCharacterAudioAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProScriptAssistantHistory" ADD CONSTRAINT "StoryProScriptAssistantHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
