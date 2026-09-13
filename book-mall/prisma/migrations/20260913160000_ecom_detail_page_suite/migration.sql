-- CreateTable
CREATE TABLE "EcomDetailPageSuiteTemplate" (
    "id" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "status" TEXT NOT NULL DEFAULT 'enable',
    "remark" TEXT,
    "modules" JSONB NOT NULL,
    "userId" TEXT,
    "createUser" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomDetailPageSuiteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcomDetailPageSuiteProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'detail-page-suite',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "brief" JSONB,
    "settings" JSONB,
    "references" JSONB,
    "chatHistory" JSONB,
    "suite" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomDetailPageSuiteProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcomDpsTpl_plat_cat_type_st_idx" ON "EcomDetailPageSuiteTemplate"("platformCode", "categoryKey", "type", "status");

-- CreateIndex
CREATE INDEX "EcomDpsTpl_user_type_del_idx" ON "EcomDetailPageSuiteTemplate"("userId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "EcomDpsTpl_type_status_upd_idx" ON "EcomDetailPageSuiteTemplate"("type", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomDetailPageSuiteProject_userId_module_updatedAt_idx" ON "EcomDetailPageSuiteProject"("userId", "module", "updatedAt");

-- CreateIndex
CREATE INDEX "EcomDetailPageSuiteProject_tenantId_visibility_updatedAt_idx" ON "EcomDetailPageSuiteProject"("tenantId", "visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "EcomDetailPageSuiteTemplate" ADD CONSTRAINT "EcomDetailPageSuiteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcomDetailPageSuiteProject" ADD CONSTRAINT "EcomDetailPageSuiteProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
