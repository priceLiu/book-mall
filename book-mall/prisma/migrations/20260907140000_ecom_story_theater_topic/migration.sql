-- CreateTable
CREATE TABLE "EcomStoryTheaterTopic" (
    "id" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storyCore" TEXT NOT NULL,
    "storyType" TEXT NOT NULL,
    "tags" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "userId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomStoryTheaterTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomStoryTheaterTopic_vertical_deletedAt_enabled_idx" ON "EcomStoryTheaterTopic"("vertical", "deletedAt", "enabled");

-- CreateIndex
CREATE INDEX "EcomStoryTheaterTopic_scope_userId_deletedAt_idx" ON "EcomStoryTheaterTopic"("scope", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "EcomStoryTheaterTopic_vertical_sortOrder_idx" ON "EcomStoryTheaterTopic"("vertical", "sortOrder");
