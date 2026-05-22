-- story-web 二期：个人空间、引擎模型目录、模型选择

-- CreateEnum
CREATE TYPE "StoryEngineRole" AS ENUM ('LLM', 'IMAGE', 'VIDEO');
CREATE TYPE "StorySpaceTemplateKey" AS ENUM ('CLASSIC_V1');
CREATE TYPE "StorySpacePublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "StoryEngineModel" (
    "id" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "role" "StoryEngineRole" NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryEngineModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorySpace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "templateKey" "StorySpaceTemplateKey" NOT NULL DEFAULT 'CLASSIC_V1',
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "ownerDisplayName" TEXT,
    "featuredWorkTitle" TEXT NOT NULL,
    "featuredWorkDescription" TEXT,
    "featuredVideoUrl" TEXT NOT NULL,
    "featuredVideoPosterUrl" TEXT,
    "publishStatus" "StorySpacePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySpace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorySpaceModelSelection" (
    "id" TEXT NOT NULL,
    "storySpaceId" TEXT NOT NULL,
    "engineModelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySpaceModelSelection_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "StoryEngineModel_modelKey_key" ON "StoryEngineModel"("modelKey");
CREATE INDEX "StoryEngineModel_role_active_sortOrder_idx" ON "StoryEngineModel"("role", "active", "sortOrder");

CREATE UNIQUE INDEX "StorySpace_userId_key" ON "StorySpace"("userId");
CREATE UNIQUE INDEX "StorySpace_slug_key" ON "StorySpace"("slug");
CREATE UNIQUE INDEX "StorySpace_publishedProductId_key" ON "StorySpace"("publishedProductId");
CREATE INDEX "StorySpace_publishStatus_idx" ON "StorySpace"("publishStatus");

CREATE UNIQUE INDEX "StorySpaceModelSelection_storySpaceId_engineModelId_key" ON "StorySpaceModelSelection"("storySpaceId", "engineModelId");
CREATE INDEX "StorySpaceModelSelection_storySpaceId_enabled_idx" ON "StorySpaceModelSelection"("storySpaceId", "enabled");

-- ForeignKeys
ALTER TABLE "StorySpace" ADD CONSTRAINT "StorySpace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorySpace" ADD CONSTRAINT "StorySpace_publishedProductId_fkey" FOREIGN KEY ("publishedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorySpaceModelSelection" ADD CONSTRAINT "StorySpaceModelSelection_storySpaceId_fkey" FOREIGN KEY ("storySpaceId") REFERENCES "StorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorySpaceModelSelection" ADD CONSTRAINT "StorySpaceModelSelection_engineModelId_fkey" FOREIGN KEY ("engineModelId") REFERENCES "StoryEngineModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: 主流引擎模型（Gemini / Nano Banana / 通义 / 可灵等）
INSERT INTO "StoryEngineModel" ("id", "modelKey", "displayName", "vendor", "role", "description", "sortOrder", "active", "defaultParams", "updatedAt") VALUES
  ('story_eng_gemini_25_flash', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'google', 'LLM', 'Google 多模态快模型，适合剧本与分镜文案。', 10, true, '{"temperature":0.7}', CURRENT_TIMESTAMP),
  ('story_eng_gemini_25_pro', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'google', 'LLM', 'Google 旗舰推理，复杂剧情与长上下文。', 20, true, '{"temperature":0.6}', CURRENT_TIMESTAMP),
  ('story_eng_qwen35_plus', 'qwen3.5-plus', 'Qwen3.5 Plus', 'aliyun', 'LLM', '通义千问，与主站价目/工具站生态一致。', 30, true, '{"temperature":0.7}', CURRENT_TIMESTAMP),
  ('story_eng_nano_banana_pro', 'nano-banana-pro', 'Nano Banana Pro（香蕉模型）', 'google', 'IMAGE', 'Google 图像生成（社区称 Banana），角色与分镜图。', 10, true, '{"aspectRatio":"16:9"}', CURRENT_TIMESTAMP),
  ('story_eng_gemini_image', 'gemini-2.0-flash-preview-image', 'Gemini 2.0 Flash Image', 'google', 'IMAGE', 'Gemini 图像预览能力，快速出图。', 20, true, '{"aspectRatio":"16:9"}', CURRENT_TIMESTAMP),
  ('story_eng_wanx21_plus', 'wanx2.1-t2i-plus', '通义万相 2.1 Plus', 'aliyun', 'IMAGE', '阿里云万相文生图，与 tool-web 文生图同系。', 30, true, '{"size":"1024*1024"}', CURRENT_TIMESTAMP),
  ('story_eng_veo2', 'veo-2', 'Google Veo 2', 'google', 'VIDEO', 'Google 视频生成，电影感镜头。', 10, true, '{"durationSec":8}', CURRENT_TIMESTAMP),
  ('story_eng_wanx_i2v', 'wanx-i2v-plus', '万相图生视频 Plus', 'aliyun', 'VIDEO', '阿里云图生视频，与 tool-web 图生视频同系。', 20, true, '{"durationSec":5}', CURRENT_TIMESTAMP),
  ('story_eng_kling_16', 'kling-v1.6', '可灵 1.6', 'kling', 'VIDEO', '快手可灵，漫剧动效与镜头运动。', 30, true, '{"durationSec":5}', CURRENT_TIMESTAMP);
