-- CreateEnum
CREATE TYPE "UserProductSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterEnum (PostgreSQL: append new value)
ALTER TYPE "OrderType" ADD VALUE 'PRODUCT_SUBSCRIPTION';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "catalogUnavailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "toolNavKey" TEXT;

-- CreateTable
CREATE TABLE "UserProductSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "UserProductSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProductSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProductSubscription_userId_productId_key" ON "UserProductSubscription"("userId", "productId");
CREATE INDEX "UserProductSubscription_userId_status_idx" ON "UserProductSubscription"("userId", "status");

ALTER TABLE "UserProductSubscription" ADD CONSTRAINT "UserProductSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductSubscription" ADD CONSTRAINT "UserProductSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
