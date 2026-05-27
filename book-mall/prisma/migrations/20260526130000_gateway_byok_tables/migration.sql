-- gateway-web BYOK proxy tables (additive only)

CREATE TYPE "GatewayUserSource" AS ENUM ('BOOK_SYNC', 'LOCAL');
CREATE TYPE "GatewayProviderKind" AS ENUM ('KIE', 'BAILIAN', 'DEEPSEEK');
CREATE TYPE "GatewayRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "GatewayRequestKind" AS ENUM ('CHAT', 'IMAGE', 'VIDEO', 'OTHER');
CREATE TYPE "GatewayMetricsSource" AS ENUM ('VENDOR', 'PLATFORM', 'UNAVAILABLE');
CREATE TYPE "GatewayClientSource" AS ENUM ('GATEWAY_CONSOLE', 'CANVAS', 'STORY', 'EXTERNAL');

CREATE TABLE "GatewayUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "bookUserId" TEXT,
    "source" "GatewayUserSource" NOT NULL DEFAULT 'LOCAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayVendorCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "providerKind" "GatewayProviderKind" NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "baseUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayVendorCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "ipWhitelist" JSONB,
    "spendLimitUsd" DECIMAL(12,4),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayApiKeyCredential" (
    "apiKeyId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,

    CONSTRAINT "GatewayApiKeyCredential_pkey" PRIMARY KEY ("apiKeyId","credentialId")
);

CREATE TABLE "GatewayRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "credentialId" TEXT,
    "providerKind" "GatewayProviderKind",
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestKind" "GatewayRequestKind" NOT NULL DEFAULT 'OTHER',
    "status" "GatewayRequestStatus" NOT NULL DEFAULT 'PENDING',
    "externalTaskId" TEXT,
    "clientSource" "GatewayClientSource" NOT NULL DEFAULT 'EXTERNAL',
    "storyProjectId" TEXT,
    "storyTaskId" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "hasTokenUsage" BOOLEAN NOT NULL DEFAULT false,
    "metricsSource" "GatewayMetricsSource" NOT NULL DEFAULT 'UNAVAILABLE',
    "durationMs" INTEGER,
    "vendorDurationMs" INTEGER,
    "pricingModelKey" TEXT,
    "pricingTierRaw" TEXT,
    "billingKind" TEXT,
    "vendorListUnitCostYuan" DECIMAL(16,8),
    "estimatedVendorCostYuan" DECIMAL(16,6),
    "inputSummary" JSONB,
    "resultSummary" JSONB,
    "failCode" TEXT,
    "failMessage" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewayUser_email_key" ON "GatewayUser"("email");
CREATE UNIQUE INDEX "GatewayUser_bookUserId_key" ON "GatewayUser"("bookUserId");

CREATE INDEX "GatewayVendorCredential_userId_active_idx" ON "GatewayVendorCredential"("userId", "active");

CREATE INDEX "GatewayApiKey_userId_revokedAt_idx" ON "GatewayApiKey"("userId", "revokedAt");
CREATE INDEX "GatewayApiKey_keyPrefix_idx" ON "GatewayApiKey"("keyPrefix");

CREATE INDEX "GatewayRequestLog_userId_submittedAt_idx" ON "GatewayRequestLog"("userId", "submittedAt");
CREATE INDEX "GatewayRequestLog_apiKeyId_submittedAt_idx" ON "GatewayRequestLog"("apiKeyId", "submittedAt");
CREATE INDEX "GatewayRequestLog_externalTaskId_idx" ON "GatewayRequestLog"("externalTaskId");
CREATE INDEX "GatewayRequestLog_status_idx" ON "GatewayRequestLog"("status");
CREATE INDEX "GatewayRequestLog_clientSource_submittedAt_idx" ON "GatewayRequestLog"("clientSource", "submittedAt");

ALTER TABLE "GatewayVendorCredential" ADD CONSTRAINT "GatewayVendorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GatewayUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayApiKey" ADD CONSTRAINT "GatewayApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GatewayUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayApiKeyCredential" ADD CONSTRAINT "GatewayApiKeyCredential_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "GatewayApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayApiKeyCredential" ADD CONSTRAINT "GatewayApiKeyCredential_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "GatewayVendorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayRequestLog" ADD CONSTRAINT "GatewayRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GatewayUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayRequestLog" ADD CONSTRAINT "GatewayRequestLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "GatewayApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayRequestLog" ADD CONSTRAINT "GatewayRequestLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "GatewayVendorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
