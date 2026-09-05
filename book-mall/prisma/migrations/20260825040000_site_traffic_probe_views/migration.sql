-- 访问统计：扫描路径仍计入 PV，另存 probe 计数以便后台标明
ALTER TABLE "SiteTrafficDaily" ADD COLUMN "probeViews" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SiteTrafficIpDaily" ADD COLUMN "probeHitCount" INTEGER NOT NULL DEFAULT 0;
