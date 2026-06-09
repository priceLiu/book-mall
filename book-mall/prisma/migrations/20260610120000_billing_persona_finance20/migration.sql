-- BillingPersona + Finance 2.0 attribution fields

CREATE TYPE "BillingPersona" AS ENUM ('PLATFORM_CREDIT', 'BYOK');

ALTER TABLE "User" ADD COLUMN "billingPersona" "BillingPersona" NOT NULL DEFAULT 'PLATFORM_CREDIT';
ALTER TABLE "User" ADD COLUMN "billingPersonaLockedAt" TIMESTAMP(3);

ALTER TABLE "GatewayApiKey" ADD COLUMN "managedByPlatform" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GatewayApiKey" ADD COLUMN "billingScope" TEXT;

ALTER TABLE "GatewayRequestLog" ADD COLUMN "staffFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GatewayRequestLog" ADD COLUMN "billingPersonaSnap" "BillingPersona";

ALTER TABLE "CreditLedger" ADD COLUMN "staffFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreditLedger" ADD COLUMN "billingPersonaSnap" "BillingPersona";

ALTER TABLE "Tenant" ADD COLUMN "gatewayApiKeyId" TEXT;
CREATE UNIQUE INDEX "Tenant_gatewayApiKeyId_key" ON "Tenant"("gatewayApiKeyId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_gatewayApiKeyId_fkey" FOREIGN KEY ("gatewayApiKeyId") REFERENCES "GatewayApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GatewayApiKey_managedByPlatform_idx" ON "GatewayApiKey"("managedByPlatform");
CREATE INDEX "GatewayRequestLog_actorBookUserId_submittedAt_idx" ON "GatewayRequestLog"("actorBookUserId", "submittedAt");
CREATE INDEX "GatewayRequestLog_staffFlag_submittedAt_idx" ON "GatewayRequestLog"("staffFlag", "submittedAt");
CREATE INDEX "GatewayRequestLog_billingPersonaSnap_submittedAt_idx" ON "GatewayRequestLog"("billingPersonaSnap", "submittedAt");
CREATE INDEX "CreditLedger_staffFlag_createdAt_idx" ON "CreditLedger"("staffFlag", "createdAt");
