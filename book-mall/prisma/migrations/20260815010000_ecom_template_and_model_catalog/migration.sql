-- CreateTable
CREATE TABLE "EcomTemplateCatalogEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hot" BOOLEAN NOT NULL DEFAULT false,
    "ossUrl" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "mainImageUrl" TEXT,
    "referenceImages" JSONB,
    "promptText" TEXT,
    "negativePrompt" TEXT,
    "defaultModelKey" TEXT,
    "defaultParams" JSONB,
    "posterUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomTemplateCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcomModelLibraryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "ossUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomModelLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomTemplateCatalogEntry_category_mediaKind_deletedAt_idx" ON "EcomTemplateCatalogEntry"("category", "mediaKind", "deletedAt");

-- CreateIndex
CREATE INDEX "EcomTemplateCatalogEntry_sortOrder_idx" ON "EcomTemplateCatalogEntry"("sortOrder");

-- CreateIndex
CREATE INDEX "EcomModelLibraryEntry_gender_age_deletedAt_idx" ON "EcomModelLibraryEntry"("gender", "age", "deletedAt");
