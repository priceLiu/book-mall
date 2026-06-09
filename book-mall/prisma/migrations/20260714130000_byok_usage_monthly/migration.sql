-- BYOK 月度用量统计（套餐内 + 超额扣分）

CREATE TABLE "ByokUsageMonthly" (
    "id" TEXT NOT NULL,
    "ownerType" "CreditOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "taskKind" "ByokTaskKind" NOT NULL,
    "seatsSnapshot" INTEGER NOT NULL DEFAULT 1,
    "includedUsed" INTEGER NOT NULL DEFAULT 0,
    "overageUsed" INTEGER NOT NULL DEFAULT 0,
    "overageCredits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokUsageMonthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ByokUsageMonthly_ownerType_ownerId_periodKey_taskKind_key" ON "ByokUsageMonthly"("ownerType", "ownerId", "periodKey", "taskKind");
CREATE INDEX "ByokUsageMonthly_periodKey_scopeKey_idx" ON "ByokUsageMonthly"("periodKey", "scopeKey");
CREATE INDEX "ByokUsageMonthly_ownerType_ownerId_periodKey_idx" ON "ByokUsageMonthly"("ownerType", "ownerId", "periodKey");
