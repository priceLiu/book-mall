-- CreateTable
CREATE TABLE "EcomHandCraftProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'hand-craft',
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

    CONSTRAINT "EcomHandCraftProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomHandCraftProject_userId_module_updatedAt_idx" ON "EcomHandCraftProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomHandCraftProject_tenantId_visibility_updatedAt_idx" ON "EcomHandCraftProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomHandCraftProject" ADD CONSTRAINT "EcomHandCraftProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
