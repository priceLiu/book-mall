-- BYOK 套餐订阅（开通标志 + 计费周期）

CREATE TYPE "ByokSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

CREATE TABLE "ByokSubscription" (
    "id" TEXT NOT NULL,
    "ownerType" "CreditOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "status" "ByokSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "techServiceFeeYuan" DECIMAL(12,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lastOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ByokSubscription_ownerType_ownerId_status_idx" ON "ByokSubscription"("ownerType", "ownerId", "status");
CREATE INDEX "ByokSubscription_periodEnd_idx" ON "ByokSubscription"("periodEnd");
CREATE INDEX "ByokSubscription_scopeKey_status_idx" ON "ByokSubscription"("scopeKey", "status");
