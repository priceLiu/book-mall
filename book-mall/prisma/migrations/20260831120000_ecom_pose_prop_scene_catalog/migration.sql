-- CreateTable
CREATE TABLE "EcomPoseLibraryEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "tags" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomPoseLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcomPropLibraryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visualDescription" TEXT NOT NULL,
    "conflictTags" JSONB,
    "ossUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomPropLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcomSceneLibraryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "tags" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomSceneLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomPoseLibraryEntry_category_deletedAt_idx" ON "EcomPoseLibraryEntry"("category", "deletedAt");

-- CreateIndex
CREATE INDEX "EcomPropLibraryEntry_deletedAt_idx" ON "EcomPropLibraryEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "EcomSceneLibraryEntry_deletedAt_idx" ON "EcomSceneLibraryEntry"("deletedAt");
