-- CreateTable
CREATE TABLE "EcomProductImageSetProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'product-image-set',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "settings" JSONB,
    "references" JSONB,
    "output" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomProductImageSetProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EcomProductImageSetProject_userId_module_updatedAt_idx" ON "EcomProductImageSetProject"("userId", "module", "updatedAt");
CREATE INDEX "EcomProductImageSetProject_tenantId_visibility_updatedAt_idx" ON "EcomProductImageSetProject"("tenantId", "visibility", "updatedAt");

ALTER TABLE "EcomProductImageSetProject" ADD CONSTRAINT "EcomProductImageSetProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
