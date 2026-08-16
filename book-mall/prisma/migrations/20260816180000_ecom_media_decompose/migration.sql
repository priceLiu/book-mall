-- CreateTable
CREATE TABLE "EcomMediaDecomposeProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'media-decompose',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "settings" JSONB,
    "references" JSONB,
    "result" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomMediaDecomposeProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomMediaDecomposeProject_userId_module_updatedAt_idx" ON "EcomMediaDecomposeProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomMediaDecomposeProject_tenantId_visibility_updatedAt_idx" ON "EcomMediaDecomposeProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomMediaDecomposeProject" ADD CONSTRAINT "EcomMediaDecomposeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
