-- CreateTable
CREATE TABLE "EcomFilmPullProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'film-pull',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "settings" JSONB,
    "references" JSONB,
    "analyzeResult" JSONB,
    "renderScript" JSONB,
    "characterRefs" JSONB,
    "renderPlan" JSONB,
    "chatHistory" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomFilmPullProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomFilmPullProject_userId_module_updatedAt_idx" ON "EcomFilmPullProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomFilmPullProject_tenantId_visibility_updatedAt_idx" ON "EcomFilmPullProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomFilmPullProject" ADD CONSTRAINT "EcomFilmPullProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
