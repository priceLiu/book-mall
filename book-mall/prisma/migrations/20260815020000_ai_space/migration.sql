-- CreateTable
CREATE TABLE "AiSpacePin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpacePin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceDigitalHuman" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "avatarImageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceDigitalHuman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceAudioAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "textScript" TEXT,
    "originApp" TEXT,
    "originRef" TEXT,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceAudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceVideoMaterial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'upload',
    "videoUrl" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceKind" TEXT NOT NULL DEFAULT 'upload',
    "composeTaskId" TEXT,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceVideoMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSpaceComposeTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digitalHumanId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "videoMaterialId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gatewayLogId" TEXT,
    "gatewayTaskId" TEXT,
    "tempHumanVideoUrl" TEXT,
    "mediaRenderJobId" TEXT,
    "finalVideoUrl" TEXT,
    "errorMessage" TEXT,
    "options" JSONB,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceComposeTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSpacePin_userId_sourceType_sourceId_key" ON "AiSpacePin"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AiSpacePin_userId_sortOrder_createdAt_idx" ON "AiSpacePin"("userId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpacePin_sourceType_sourceId_idx" ON "AiSpacePin"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AiSpaceDigitalHuman_userId_createdAt_idx" ON "AiSpaceDigitalHuman"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceDigitalHuman_tenantId_visibility_createdAt_idx" ON "AiSpaceDigitalHuman"("tenantId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceAudioAsset_userId_createdAt_idx" ON "AiSpaceAudioAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceAudioAsset_tenantId_visibility_createdAt_idx" ON "AiSpaceAudioAsset"("tenantId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceAudioAsset_originApp_originRef_idx" ON "AiSpaceAudioAsset"("originApp", "originRef");

-- CreateIndex
CREATE INDEX "AiSpaceVideoMaterial_userId_category_createdAt_idx" ON "AiSpaceVideoMaterial"("userId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceVideoMaterial_tenantId_visibility_createdAt_idx" ON "AiSpaceVideoMaterial"("tenantId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceVideoMaterial_composeTaskId_idx" ON "AiSpaceVideoMaterial"("composeTaskId");

-- CreateIndex
CREATE INDEX "AiSpaceComposeTask_userId_createdAt_idx" ON "AiSpaceComposeTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSpaceComposeTask_status_createdAt_idx" ON "AiSpaceComposeTask"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiSpacePin" ADD CONSTRAINT "AiSpacePin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceDigitalHuman" ADD CONSTRAINT "AiSpaceDigitalHuman_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceAudioAsset" ADD CONSTRAINT "AiSpaceAudioAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceVideoMaterial" ADD CONSTRAINT "AiSpaceVideoMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSpaceComposeTask" ADD CONSTRAINT "AiSpaceComposeTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
