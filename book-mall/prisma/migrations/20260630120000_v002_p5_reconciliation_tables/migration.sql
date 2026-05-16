-- v002 P5：对账 UI 三表
--   - CloudAccountBinding：云账号 ↔ 平台 User 绑定
--   - BillingReconciliationRun：一次对账批次
--   - BillingReconciliationLine：批次内单用户 × 单(model/billingKind) 一行

CREATE TABLE "CloudAccountBinding" (
  "id" TEXT NOT NULL,
  "cloudAccountId" TEXT NOT NULL,
  "cloudAccountName" TEXT,
  "userId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAccountBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudAccountBinding_cloudAccountId_key" ON "CloudAccountBinding"("cloudAccountId");
CREATE INDEX "CloudAccountBinding_userId_idx" ON "CloudAccountBinding"("userId");

ALTER TABLE "CloudAccountBinding"
  ADD CONSTRAINT "CloudAccountBinding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingReconciliationRun" (
  "id" TEXT NOT NULL,
  "csvSha256" TEXT NOT NULL,
  "csvFilename" TEXT NOT NULL,
  "monthsCovered" TEXT NOT NULL,
  "importedByUserId" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingReconciliationRun_csvSha256_key" ON "BillingReconciliationRun"("csvSha256");
CREATE INDEX "BillingReconciliationRun_createdAt_idx" ON "BillingReconciliationRun"("createdAt");
CREATE INDEX "BillingReconciliationRun_importedByUserId_idx" ON "BillingReconciliationRun"("importedByUserId");

CREATE TABLE "BillingReconciliationLine" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "userId" TEXT,
  "cloudAccountId" TEXT,
  "modelKey" TEXT NOT NULL,
  "billingKind" TEXT NOT NULL,
  "internalCount" INTEGER NOT NULL DEFAULT 0,
  "internalYuan" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "cloudCount" INTEGER NOT NULL DEFAULT 0,
  "cloudPayableYuan" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "diffYuan" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "matchKind" TEXT NOT NULL,
  "clawbackPoints" INTEGER,
  "clawbackEntryId" TEXT,
  "clawedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingReconciliationLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingReconciliationLine_runId_userId_idx" ON "BillingReconciliationLine"("runId", "userId");
CREATE INDEX "BillingReconciliationLine_runId_matchKind_idx" ON "BillingReconciliationLine"("runId", "matchKind");

ALTER TABLE "BillingReconciliationLine"
  ADD CONSTRAINT "BillingReconciliationLine_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "BillingReconciliationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
