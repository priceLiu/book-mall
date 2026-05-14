-- CreateEnum
CREATE TYPE "RechargeCouponStatus" AS ENUM ('UNUSED', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RechargePromoTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "paidAmountPoints" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "claimableFrom" TIMESTAMP(3) NOT NULL,
    "claimableTo" TIMESTAMP(3) NOT NULL,
    "validDaysAfterClaim" INTEGER NOT NULL DEFAULT 7,
    "maxClaimsPerUser" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargePromoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRechargeCoupon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "RechargeCouponStatus" NOT NULL DEFAULT 'UNUSED',
    "paidAmountPointsSnap" INTEGER NOT NULL,
    "bonusPointsSnap" INTEGER NOT NULL,
    "titleSnap" TEXT NOT NULL,
    "templateSlugSnap" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "orderId" TEXT,

    CONSTRAINT "UserRechargeCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RechargePromoTemplate_slug_key" ON "RechargePromoTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserRechargeCoupon_orderId_key" ON "UserRechargeCoupon"("orderId");

-- CreateIndex
CREATE INDEX "UserRechargeCoupon_userId_status_idx" ON "UserRechargeCoupon"("userId", "status");

-- CreateIndex
CREATE INDEX "UserRechargeCoupon_userId_templateId_idx" ON "UserRechargeCoupon"("userId", "templateId");

-- CreateIndex
CREATE INDEX "UserRechargeCoupon_expiresAt_idx" ON "UserRechargeCoupon"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserRechargeCoupon" ADD CONSTRAINT "UserRechargeCoupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRechargeCoupon" ADD CONSTRAINT "UserRechargeCoupon_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RechargePromoTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRechargeCoupon" ADD CONSTRAINT "UserRechargeCoupon_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 示例模板（演示「充 100 元送 120 点」，须用户领取后充值核销）
INSERT INTO "RechargePromoTemplate" (
    "id", "slug", "title", "paidAmountPoints", "bonusPoints", "active",
    "claimableFrom", "claimableTo", "validDaysAfterClaim", "maxClaimsPerUser", "sortOrder", "note", "createdAt", "updatedAt"
) VALUES (
    'seed_recharge_tpl_100_bonus_120',
    'recharge_100_bonus_120',
    '充 ¥100 送 120 点',
    10000,
    120,
    true,
    TIMESTAMP '2026-01-01 00:00:00',
    TIMESTAMP '2030-12-31 23:59:59',
    30,
    1,
    0,
    '示例：实付须恰好 10000 点；领取后 30 日内、有一次核销机会。',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
