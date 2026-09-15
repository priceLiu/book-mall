-- CreateEnum
CREATE TYPE "SceneTemplateStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "SceneTemplateModelStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DEPRECATED');

-- CreateTable
CREATE TABLE "SceneTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SceneTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rulesJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneTemplateModel" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "canonicalModelKey" TEXT NOT NULL,
    "status" "SceneTemplateModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rulesOverrideJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneTemplateModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelTemplateCatalogSnapshot" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "ModelTemplateCatalogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SceneTemplate_status_sortOrder_idx" ON "SceneTemplate"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "SceneTemplateModel_canonicalModelKey_idx" ON "SceneTemplateModel"("canonicalModelKey");

-- CreateIndex
CREATE INDEX "SceneTemplateModel_templateId_status_sortOrder_idx" ON "SceneTemplateModel"("templateId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SceneTemplateModel_templateId_canonicalModelKey_key" ON "SceneTemplateModel"("templateId", "canonicalModelKey");

-- CreateIndex
CREATE UNIQUE INDEX "ModelTemplateCatalogSnapshot_version_key" ON "ModelTemplateCatalogSnapshot"("version");

-- CreateIndex
CREATE INDEX "ModelTemplateCatalogSnapshot_publishedAt_idx" ON "ModelTemplateCatalogSnapshot"("publishedAt");

-- AddForeignKey
ALTER TABLE "SceneTemplateModel" ADD CONSTRAINT "SceneTemplateModel_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SceneTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
