-- CreateEnum
CREATE TYPE "ProjectAssetKind" AS ENUM ('CHARACTER', 'SCENE', 'PROP', 'OUTLINE', 'STORYBOARD_SCRIPT', 'AUDIO', 'STORYBOARD_IMAGE', 'STORYBOARD_VIDEO', 'DIGITAL_HUMAN', 'STYLE', 'PROMPT', 'GROUP_BUNDLE');

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "kind" "ProjectAssetKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "sourceProjectId" TEXT,
    "sourceNodeId" TEXT,
    "sourceEdition" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "editLockUserId" TEXT,
    "editLockExpiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssetRef" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "meta" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectAssetRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAsset_tenantId_kind_visibility_updatedAt_idx" ON "ProjectAsset"("tenantId", "kind", "visibility", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectAsset_ownerUserId_updatedAt_idx" ON "ProjectAsset"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectAsset_sourceProjectId_kind_idx" ON "ProjectAsset"("sourceProjectId", "kind");

-- CreateIndex
CREATE INDEX "ProjectAsset_deletedAt_idx" ON "ProjectAsset"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectAssetRef_assetId_sortOrder_idx" ON "ProjectAssetRef"("assetId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssetRef" ADD CONSTRAINT "ProjectAssetRef_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ProjectAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
