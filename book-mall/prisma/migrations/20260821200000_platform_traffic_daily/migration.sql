-- CreateTable
CREATE TABLE "SiteTrafficDaily" (
    "id" TEXT NOT NULL,
    "dateCst" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteTrafficDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteTrafficIpDaily" (
    "id" TEXT NOT NULL,
    "dateCst" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "SiteTrafficIpDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteTrafficDaily_dateCst_appKey_key" ON "SiteTrafficDaily"("dateCst", "appKey");

-- CreateIndex
CREATE INDEX "SiteTrafficDaily_dateCst_idx" ON "SiteTrafficDaily"("dateCst");

-- CreateIndex
CREATE UNIQUE INDEX "SiteTrafficIpDaily_dateCst_appKey_ip_key" ON "SiteTrafficIpDaily"("dateCst", "appKey", "ip");

-- CreateIndex
CREATE INDEX "SiteTrafficIpDaily_dateCst_appKey_hitCount_idx" ON "SiteTrafficIpDaily"("dateCst", "appKey", "hitCount" DESC);

-- AddForeignKey
ALTER TABLE "SiteTrafficIpDaily" ADD CONSTRAINT "SiteTrafficIpDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
