-- 角色资产版本 + 场景资产库（P-B1 / P-B2）
ALTER TABLE "StoryProCharacterAsset" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "StoryProSceneAssetRefKind" AS ENUM ('establishing', 'detail', 'mood');

CREATE TABLE "StoryProSceneAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sceneKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "projectId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProSceneAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryProSceneAssetRef" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "StoryProSceneAssetRefKind" NOT NULL,
    "ossUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "sourceTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryProSceneAssetRef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryProSceneAsset_userId_sceneKey_projectId_key" ON "StoryProSceneAsset"("userId", "sceneKey", "projectId");
CREATE INDEX "StoryProSceneAsset_userId_updatedAt_idx" ON "StoryProSceneAsset"("userId", "updatedAt");
CREATE INDEX "StoryProSceneAssetRef_assetId_sortOrder_idx" ON "StoryProSceneAssetRef"("assetId", "sortOrder");

ALTER TABLE "StoryProSceneAsset" ADD CONSTRAINT "StoryProSceneAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryProSceneAssetRef" ADD CONSTRAINT "StoryProSceneAssetRef_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "StoryProSceneAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
