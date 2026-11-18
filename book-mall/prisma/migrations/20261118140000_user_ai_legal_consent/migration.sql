-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiUserAgreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN "aiAppPermissionsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "aiPrivacyPolicyAcceptedAt" TIMESTAMP(3);