-- CreateTable
CREATE TABLE "EcomModelShotProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'model-shot',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "brief" JSONB,
    "settings" JSONB,
    "references" JSONB,
    "chatHistory" JSONB,
    "plan" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomModelShotProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomModelShotProject_userId_module_updatedAt_idx" ON "EcomModelShotProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomModelShotProject_tenantId_visibility_updatedAt_idx" ON "EcomModelShotProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomModelShotProject" ADD CONSTRAINT "EcomModelShotProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
