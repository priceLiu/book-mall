-- CreateEnum
CREATE TYPE "PlatformErrorSource" AS ENUM ('CANVAS', 'STORY', 'GATEWAY', 'BOOK', 'TOOL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlatformErrorSeverity" AS ENUM ('ERROR', 'WARN');

-- CreateTable
CREATE TABLE "PlatformErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PlatformErrorSource" NOT NULL,
    "severity" "PlatformErrorSeverity" NOT NULL DEFAULT 'ERROR',
    "code" TEXT,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "context" JSONB,
    "fingerprint" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,

    CONSTRAINT "PlatformErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformErrorLog_createdAt_idx" ON "PlatformErrorLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformErrorLog_source_createdAt_idx" ON "PlatformErrorLog"("source", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformErrorLog_code_idx" ON "PlatformErrorLog"("code");

-- CreateIndex
CREATE INDEX "PlatformErrorLog_fingerprint_createdAt_idx" ON "PlatformErrorLog"("fingerprint", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PlatformErrorLog_resolvedAt_idx" ON "PlatformErrorLog"("resolvedAt");
