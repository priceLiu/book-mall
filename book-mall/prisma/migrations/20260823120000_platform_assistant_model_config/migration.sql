-- AI 小智 · 模型配置（Book 管理后台）
CREATE TABLE "PlatformAssistantModelConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatModelKey" TEXT NOT NULL DEFAULT 'qwen3.5-27b',
    "chatFallbackModelKeys" TEXT[] DEFAULT ARRAY['qwen3.5-flash']::TEXT[],
    "newsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newsModelKey" TEXT NOT NULL DEFAULT 'qwen3.5-27b',
    "newsFallbackModelKeys" TEXT[] DEFAULT ARRAY['qwen3.5-flash']::TEXT[],
    "embedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "embedModelKey" TEXT NOT NULL DEFAULT 'text-embedding-v3',
    "embedDim" INTEGER NOT NULL DEFAULT 1024,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAssistantModelConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformAssistantModelConfig" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
