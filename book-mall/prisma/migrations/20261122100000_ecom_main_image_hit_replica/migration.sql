-- CreateTable
CREATE TABLE "EcomMainImageHitReplicaProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'main-image-hit-replica',
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

    CONSTRAINT "EcomMainImageHitReplicaProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomMainImageHitReplicaProject_userId_module_updatedAt_idx" ON "EcomMainImageHitReplicaProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomMainImageHitReplicaProject_tenantId_visibility_updatedAt_idx" ON "EcomMainImageHitReplicaProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomMainImageHitReplicaProject" ADD CONSTRAINT "EcomMainImageHitReplicaProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;