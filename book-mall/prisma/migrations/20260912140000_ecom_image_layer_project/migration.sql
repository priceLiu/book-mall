-- CreateTable
CREATE TABLE "EcomImageLayerProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'image-layer',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workspace" JSONB,
    "generations" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomImageLayerProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomImageLayerProject_userId_module_updatedAt_idx" ON "EcomImageLayerProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomImageLayerProject_tenantId_visibility_updatedAt_idx" ON "EcomImageLayerProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomImageLayerProject" ADD CONSTRAINT "EcomImageLayerProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
