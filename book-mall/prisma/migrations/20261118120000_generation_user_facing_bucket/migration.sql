-- CreateEnum
CREATE TYPE "GenerationUserFacingBucket" AS ENUM ('USER_CREDITS', 'PLATFORM_BILLING', 'VENDOR_INPUT', 'VENDOR_QUEUE');

-- AlterTable
ALTER TABLE "GatewayRequestLog" ADD COLUMN "userFacingBucket" "GenerationUserFacingBucket";

-- AlterTable
ALTER TABLE "GatewayRequestLogArchive" ADD COLUMN "userFacingBucket" "GenerationUserFacingBucket";

-- CreateIndex
CREATE INDEX "GatewayRequestLog_userFacingBucket_submittedAt_idx" ON "GatewayRequestLog"("userFacingBucket", "submittedAt");