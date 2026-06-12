-- CreateEnum
CREATE TYPE "MediaRenderJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaRenderStorageTier" AS ENUM ('ephemeral', 'pinned');

-- CreateEnum
CREATE TYPE "MediaRenderSourceApp" AS ENUM ('canvas', 'ecom', 'api');

-- CreateTable
CREATE TABLE "MediaRenderJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceApp" "MediaRenderSourceApp" NOT NULL,
    "sourceRef" JSONB,
    "timelineJson" JSONB NOT NULL,
    "profileJson" JSONB NOT NULL,
    "status" "MediaRenderJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultOssUrl" TEXT,
    "errorMessage" TEXT,
    "bytesOut" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "storageTier" "MediaRenderStorageTier" NOT NULL DEFAULT 'ephemeral',
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MediaRenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMediaStorageGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bytesQuota" BIGINT NOT NULL,
    "bytesUsed" BIGINT NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMediaStorageGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaRenderJob_userId_status_createdAt_idx" ON "MediaRenderJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaRenderJob_expiresAt_storageTier_status_idx" ON "MediaRenderJob"("expiresAt", "storageTier", "status");

-- CreateIndex
CREATE INDEX "UserMediaStorageGrant_userId_expiresAt_idx" ON "UserMediaStorageGrant"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "MediaRenderJob" ADD CONSTRAINT "MediaRenderJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMediaStorageGrant" ADD CONSTRAINT "UserMediaStorageGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
