-- BYOK 简化为个人/团队两档 + 任务额度与超额扣分

CREATE TYPE "ByokTaskKind" AS ENUM ('TEXT_TO_IMAGE', 'IMAGE_TO_VIDEO', 'VIDEO_TO_VIDEO');

ALTER TABLE "ByokServiceConfig" ADD COLUMN IF NOT EXISTS "minSeats" INTEGER;

CREATE TABLE "ByokTaskQuota" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "taskKind" "ByokTaskKind" NOT NULL,
    "label" TEXT NOT NULL,
    "monthlyIncluded" INTEGER NOT NULL,
    "overageCredits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByokTaskQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ByokTaskQuota_scopeKey_taskKind_key" ON "ByokTaskQuota"("scopeKey", "taskKind");
CREATE INDEX "ByokTaskQuota_scopeKey_idx" ON "ByokTaskQuota"("scopeKey");
