-- CreateEnum
CREATE TYPE "AiSpacePageTemplate" AS ENUM ('MAGAZINE', 'PORTFOLIO', 'BENTO', 'TIMELINE', 'MINIMAL');

-- CreateEnum
CREATE TYPE "AiSpacePagePublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "AiSpacePage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT '我的 AI 空间',
    "bio" TEXT NOT NULL DEFAULT '',
    "templateKey" "AiSpacePageTemplate" NOT NULL DEFAULT 'BENTO',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "publishStatus" "AiSpacePagePublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpacePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockType" VARCHAR(40) NOT NULL,
    "sizeTier" VARCHAR(16) NOT NULL DEFAULT 'lg',
    "layoutX" INTEGER NOT NULL DEFAULT 0,
    "layoutY" INTEGER NOT NULL DEFAULT 0,
    "layoutW" INTEGER NOT NULL DEFAULT 6,
    "layoutH" INTEGER NOT NULL DEFAULT 6,
    "layoutZ" INTEGER NOT NULL DEFAULT 0,
    "mobileOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceBlockRef" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "slotKey" VARCHAR(32) NOT NULL DEFAULT '',
    "caption" VARCHAR(200),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSpaceBlockRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSpacePage_userId_key" ON "AiSpacePage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiSpacePage_slug_key" ON "AiSpacePage"("slug");

-- CreateIndex
CREATE INDEX "AiSpacePage_publishStatus_idx" ON "AiSpacePage"("publishStatus");

-- CreateIndex
CREATE INDEX "AiSpaceBlock_pageId_layoutY_layoutX_idx" ON "AiSpaceBlock"("pageId", "layoutY", "layoutX");

-- CreateIndex
CREATE INDEX "AiSpaceBlock_userId_idx" ON "AiSpaceBlock"("userId");

-- CreateIndex
CREATE INDEX "AiSpaceBlockRef_blockId_sortOrder_idx" ON "AiSpaceBlockRef"("blockId", "sortOrder");

-- CreateIndex
CREATE INDEX "AiSpaceBlockRef_sourceType_sourceId_idx" ON "AiSpaceBlockRef"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "AiSpacePage" ADD CONSTRAINT "AiSpacePage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceBlock" ADD CONSTRAINT "AiSpaceBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AiSpacePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceBlockRef" ADD CONSTRAINT "AiSpaceBlockRef_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "AiSpaceBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
