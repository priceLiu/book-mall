-- CreateTable
CREATE TABLE "EcomIpMasterProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'ip-master',
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

    CONSTRAINT "EcomIpMasterProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomIpMasterProject_userId_module_updatedAt_idx" ON "EcomIpMasterProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomIpMasterProject_tenantId_visibility_updatedAt_idx" ON "EcomIpMasterProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomIpMasterProject" ADD CONSTRAINT "EcomIpMasterProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
