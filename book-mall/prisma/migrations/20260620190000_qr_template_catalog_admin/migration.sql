-- QuickReplica · 管理后台维护公开模板 / 覆盖内置模板

ALTER TABLE "QrTemplate" ADD COLUMN "catalogBuiltinId" TEXT;
ALTER TABLE "QrTemplate" ADD COLUMN "isPlatformCatalog" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "QrTemplate_catalogBuiltinId_key" ON "QrTemplate"("catalogBuiltinId");
CREATE INDEX "QrTemplate_isPlatformCatalog_visibility_deletedAt_idx" ON "QrTemplate"("isPlatformCatalog", "visibility", "deletedAt");
