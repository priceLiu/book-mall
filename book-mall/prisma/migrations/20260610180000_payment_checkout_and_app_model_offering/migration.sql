-- CreateEnum
CREATE TYPE "PaymentProductKind" AS ENUM ('MEMBERSHIP_PERSONAL', 'MEMBERSHIP_TEAM', 'BYOK_PERSONAL', 'BYOK_TEAM', 'CREDIT_TOPUP');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('WECHAT_PERSONAL', 'MOCK');

-- CreateEnum
CREATE TYPE "PaymentCheckoutStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRM', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentConfirmMode" AS ENUM ('ADMIN_MANUAL', 'ADMIN_INSTANT');

-- CreateEnum
CREATE TYPE "PaymentEventAction" AS ENUM ('CREATE', 'USER_SUBMITTED', 'ADMIN_CONFIRM', 'ADMIN_INSTANT', 'EXPIRE', 'CANCEL');

-- CreateEnum
CREATE TYPE "AppModelOfferingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'MEMBERSHIP';
ALTER TYPE "OrderType" ADD VALUE 'CREDIT_TOPUP';
ALTER TYPE "OrderType" ADD VALUE 'BYOK_SERVICE_FEE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "amountYuan" DECIMAL(12,2),
ADD COLUMN "paymentCheckoutId" TEXT;

-- CreateTable
CREATE TABLE "PaymentCheckout" (
    "id" TEXT NOT NULL,
    "outTradeNo" TEXT NOT NULL,
    "remarkCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productKind" "PaymentProductKind" NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "amountYuan" DECIMAL(12,2) NOT NULL,
    "channel" "PaymentChannel" NOT NULL DEFAULT 'WECHAT_PERSONAL',
    "status" "PaymentCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "confirmMode" "PaymentConfirmMode",
    "confirmedByUserId" TEXT,
    "adminNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "PaymentEventAction" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppModelOffering" (
    "id" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "role" "CanvasModelRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "requestKind" "GatewayRequestKind" NOT NULL,
    "activeCanonicalKey" TEXT,
    "activeProviderKind" "GatewayProviderKind",
    "activeModelKey" TEXT,
    "publishedCreditsPerUnit" INTEGER,
    "estimatedMargin" DECIMAL(6,4),
    "routeLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "AppModelOfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppModelOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppModelCandidate" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "canonicalModelKey" TEXT NOT NULL,
    "providerKind" "GatewayProviderKind" NOT NULL,
    "modelKey" TEXT NOT NULL,
    "netCostYuan" DECIMAL(16,8) NOT NULL,
    "marginOk" BOOLEAN NOT NULL DEFAULT true,
    "autoScore" DECIMAL(12,6),
    "isActiveRoute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppModelCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingPublishLog" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromCanonicalKey" TEXT,
    "toCanonicalKey" TEXT,
    "fromProviderKind" TEXT,
    "toProviderKind" TEXT,
    "netCostYuan" DECIMAL(16,8),
    "estimatedMargin" DECIMAL(6,4),
    "publishedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferingPublishLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentCheckoutId_key" ON "Order"("paymentCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCheckout_outTradeNo_key" ON "PaymentCheckout"("outTradeNo");

-- CreateIndex
CREATE INDEX "PaymentCheckout_userId_createdAt_idx" ON "PaymentCheckout"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentCheckout_remarkCode_status_idx" ON "PaymentCheckout"("remarkCode", "status");

-- CreateIndex
CREATE INDEX "PaymentCheckout_status_createdAt_idx" ON "PaymentCheckout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_checkoutId_createdAt_idx" ON "PaymentEvent"("checkoutId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppModelOffering_appKey_scenarioKey_key" ON "AppModelOffering"("appKey", "scenarioKey");

-- CreateIndex
CREATE INDEX "AppModelOffering_appKey_role_status_idx" ON "AppModelOffering"("appKey", "role", "status");

-- CreateIndex
CREATE INDEX "AppModelCandidate_offeringId_isActiveRoute_idx" ON "AppModelCandidate"("offeringId", "isActiveRoute");

-- CreateIndex
CREATE INDEX "AppModelCandidate_canonicalModelKey_idx" ON "AppModelCandidate"("canonicalModelKey");

-- CreateIndex
CREATE INDEX "OfferingPublishLog_offeringId_createdAt_idx" ON "OfferingPublishLog"("offeringId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentCheckoutId_fkey" FOREIGN KEY ("paymentCheckoutId") REFERENCES "PaymentCheckout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCheckout" ADD CONSTRAINT "PaymentCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCheckout" ADD CONSTRAINT "PaymentCheckout_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "PaymentCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppModelCandidate" ADD CONSTRAINT "AppModelCandidate_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "AppModelOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingPublishLog" ADD CONSTRAINT "OfferingPublishLog_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "AppModelOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
