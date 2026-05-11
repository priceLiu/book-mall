-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "llmInputPer1kTokensMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformConfig" ADD COLUMN     "llmOutputPer1kTokensMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformConfig" ADD COLUMN     "toolInvokePerCallMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformConfig" ADD COLUMN     "usageAnomalyRatioPercent" INTEGER NOT NULL DEFAULT 300;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WalletRefundRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAmountMinor" INTEGER,
    "pendingSettlementMinor" INTEGER NOT NULL DEFAULT 0,
    "refundAmountMinor" INTEGER,
    "userNote" TEXT,
    "adminNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionRefundRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "userReason" TEXT,
    "adminNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletRefundRequest_userId_status_idx" ON "WalletRefundRequest"("userId", "status");
CREATE INDEX "WalletRefundRequest_status_createdAt_idx" ON "WalletRefundRequest"("status", "createdAt");
CREATE INDEX "SubscriptionRefundRequest_status_createdAt_idx" ON "SubscriptionRefundRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletRefundRequest" ADD CONSTRAINT "WalletRefundRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundRequest" ADD CONSTRAINT "SubscriptionRefundRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
