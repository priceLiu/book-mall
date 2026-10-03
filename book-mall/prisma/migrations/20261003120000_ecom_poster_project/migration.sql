-- CreateTable
CREATE TABLE "EcomPosterProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'poster',
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

    CONSTRAINT "EcomPosterProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomPosterProject_userId_module_updatedAt_idx" ON "EcomPosterProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomPosterProject_tenantId_visibility_updatedAt_idx" ON "EcomPosterProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomPosterProject" ADD CONSTRAINT "EcomPosterProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
