-- CreateTable
CREATE TABLE "EcomSeedVideoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'seed-video',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "brief" JSONB,
    "settings" JSONB,
    "references" JSONB,
    "chatHistory" JSONB,
    "plan" JSONB,
    "videoAssetId" TEXT,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomSeedVideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomSeedVideoProject_userId_module_updatedAt_idx" ON "EcomSeedVideoProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomSeedVideoProject_tenantId_visibility_updatedAt_idx" ON "EcomSeedVideoProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomSeedVideoProject" ADD CONSTRAINT "EcomSeedVideoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
