-- CreateEnum
CREATE TYPE "StoryProCharacterAssetRefKind" AS ENUM ('face', 'full_body', 'outfit', 'three_view');

-- CreateTable
CREATE TABLE "StoryProCharacterAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "projectId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryProCharacterAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryProCharacterAssetRef" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "StoryProCharacterAssetRefKind" NOT NULL,
    "ossUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "sourceTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryProCharacterAssetRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryProCharacterAsset_userId_updatedAt_idx" ON "StoryProCharacterAsset"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryProCharacterAsset_userId_characterKey_projectId_key" ON "StoryProCharacterAsset"("userId", "characterKey", "projectId");

-- CreateIndex
CREATE INDEX "StoryProCharacterAssetRef_assetId_sortOrder_idx" ON "StoryProCharacterAssetRef"("assetId", "sortOrder");

-- AddForeignKey
ALTER TABLE "StoryProCharacterAsset" ADD CONSTRAINT "StoryProCharacterAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryProCharacterAssetRef" ADD CONSTRAINT "StoryProCharacterAssetRef_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "StoryProCharacterAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
