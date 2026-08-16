-- CreateEnum
CREATE TYPE "CreditOpsJobType" AS ENUM ('DAILY_EXPIRE_SWEEP', 'DAILY_SUBSCRIPTION_RESET', 'MANUAL_BACKFILL');

-- CreateEnum
CREATE TYPE "CreditOpsJobTrigger" AS ENUM ('CRON', 'ADMIN', 'SCRIPT');

-- CreateEnum
CREATE TYPE "CreditOpsJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "CreditOpsWorkType" AS ENUM ('BATCH_EXPIRE', 'SUBSCRIPTION_RESET');

-- CreateEnum
CREATE TYPE "CreditOpsWorkStatus" AS ENUM ('PENDING', 'OVERDUE', 'RUNNING', 'DONE', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "CreditOpsJobRun" (
    "id" TEXT NOT NULL,
    "jobType" "CreditOpsJobType" NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "trigger" "CreditOpsJobTrigger" NOT NULL,
    "triggeredByUserId" TEXT,
    "status" "CreditOpsJobStatus" NOT NULL DEFAULT 'RUNNING',
    "statsJson" JSONB,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CreditOpsJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditOpsWorkItem" (
    "id" TEXT NOT NULL,
    "workType" "CreditOpsWorkType" NOT NULL,
    "dueDate" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerType" "CreditOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerHint" TEXT,
    "pool" "CreditPool" NOT NULL DEFAULT 'GENERAL',
    "source" "CreditSource",
    "periodKey" TEXT NOT NULL DEFAULT '',
    "expectedExpireCredits" INTEGER NOT NULL DEFAULT 0,
    "expectedGrantCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "CreditOpsWorkStatus" NOT NULL DEFAULT 'PENDING',
    "isBackfill" BOOLEAN NOT NULL DEFAULT false,
    "jobRunId" TEXT,
    "processedAt" TIMESTAMP(3),
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditOpsWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditOpsJobRun_scheduledDate_jobType_idx" ON "CreditOpsJobRun"("scheduledDate", "jobType");

-- CreateIndex
CREATE INDEX "CreditOpsJobRun_startedAt_idx" ON "CreditOpsJobRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditOpsWorkItem_workType_accountId_pool_dueDate_periodKey_key" ON "CreditOpsWorkItem"("workType", "accountId", "pool", "dueDate", "periodKey");

-- CreateIndex
CREATE INDEX "CreditOpsWorkItem_dueDate_status_idx" ON "CreditOpsWorkItem"("dueDate", "status");

-- CreateIndex
CREATE INDEX "CreditOpsWorkItem_status_idx" ON "CreditOpsWorkItem"("status");

-- CreateIndex
CREATE INDEX "CreditOpsWorkItem_accountId_idx" ON "CreditOpsWorkItem"("accountId");

-- AddForeignKey
ALTER TABLE "CreditOpsWorkItem" ADD CONSTRAINT "CreditOpsWorkItem_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "CreditOpsJobRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
