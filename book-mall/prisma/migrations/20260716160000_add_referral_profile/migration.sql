-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referredByUserId" TEXT;

-- CreateTable
CREATE TABLE "ReferralProfile" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "rateUpdatedAt" TIMESTAMP(3),
    "rateUpdatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProfile_referrerUserId_key" ON "ReferralProfile"("referrerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProfile_code_key" ON "ReferralProfile"("code");

-- CreateIndex
CREATE INDEX "ReferralProfile_code_idx" ON "ReferralProfile"("code");

-- CreateIndex
CREATE INDEX "User_referredByUserId_idx" ON "User"("referredByUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralProfile" ADD CONSTRAINT "ReferralProfile_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
