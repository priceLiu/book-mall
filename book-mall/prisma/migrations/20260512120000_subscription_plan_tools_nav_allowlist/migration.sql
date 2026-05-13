-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN "toolsNavAllowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
