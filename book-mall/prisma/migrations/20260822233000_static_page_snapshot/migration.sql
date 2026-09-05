-- Static page snapshot CMS (homepage Phase 1)

CREATE TYPE "StaticSnapshotStatus" AS ENUM ('READY', 'FAILED');

CREATE TYPE "StaticSnapshotTrigger" AS ENUM ('CRON', 'ADMIN', 'CLI');

CREATE TABLE "StaticPageSnapshot" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "status" "StaticSnapshotStatus" NOT NULL DEFAULT 'READY',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaticPageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaticSnapshotGenerationRun" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "status" "StaticSnapshotStatus" NOT NULL,
    "trigger" "StaticSnapshotTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "summary" JSONB,
    "triggeredByUserId" TEXT,

    CONSTRAINT "StaticSnapshotGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaticPageSnapshot_pageKey_dateKey_key" ON "StaticPageSnapshot"("pageKey", "dateKey");

CREATE INDEX "StaticPageSnapshot_pageKey_dateKey_idx" ON "StaticPageSnapshot"("pageKey", "dateKey" DESC);

CREATE INDEX "StaticPageSnapshot_pageKey_status_generatedAt_idx" ON "StaticPageSnapshot"("pageKey", "status", "generatedAt" DESC);

CREATE INDEX "StaticSnapshotGenerationRun_pageKey_startedAt_idx" ON "StaticSnapshotGenerationRun"("pageKey", "startedAt" DESC);

CREATE INDEX "StaticSnapshotGenerationRun_pageKey_dateKey_idx" ON "StaticSnapshotGenerationRun"("pageKey", "dateKey");

ALTER TABLE "StaticSnapshotGenerationRun" ADD CONSTRAINT "StaticSnapshotGenerationRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
