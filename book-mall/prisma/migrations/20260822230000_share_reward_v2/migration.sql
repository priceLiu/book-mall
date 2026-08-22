-- 分享规则 2.0

CREATE TYPE "ShareRewardChannel" AS ENUM ('REFERRAL', 'WORKFLOW');
CREATE TYPE "WorkflowShareApp" AS ENUM ('CANVAS', 'ECOM', 'QUICK_REPLICA');

ALTER TABLE "PlatformPricingConfig"
  ADD COLUMN IF NOT EXISTS "referralRewardCredits" INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "workflowShareRewardCredits" INT NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "shareRewardCreditsExpireDays" INT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "shareRewardDailyCapPerReferrer" INT NOT NULL DEFAULT 0;

CREATE TABLE "ShareRewardAttribution" (
  "id" TEXT NOT NULL,
  "inviteeUserId" TEXT NOT NULL,
  "channel" "ShareRewardChannel" NOT NULL,
  "referrerUserId" TEXT NOT NULL,
  "referralCode" TEXT,
  "workflowClaimId" TEXT,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShareRewardAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShareRewardProgress" (
  "inviteeUserId" TEXT NOT NULL,
  "firstBillableAt" TIMESTAMP(3),
  "firstPaidAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShareRewardProgress_pkey" PRIMARY KEY ("inviteeUserId")
);

CREATE TABLE "ShareRewardGrant" (
  "id" TEXT NOT NULL,
  "inviteeUserId" TEXT NOT NULL,
  "referrerUserId" TEXT NOT NULL,
  "channel" "ShareRewardChannel" NOT NULL,
  "credits" INT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShareRewardGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowShareLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "app" "WorkflowShareApp" NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "sharerUserId" TEXT NOT NULL,
  "title" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "maxClaims" INT,
  "claimCount" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowShareClaim" (
  "id" TEXT NOT NULL,
  "shareLinkId" TEXT NOT NULL,
  "claimerUserId" TEXT NOT NULL,
  "clonedResourceId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rewardGrantedAt" TIMESTAMP(3),
  CONSTRAINT "WorkflowShareClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShareRewardAttribution_inviteeUserId_key" ON "ShareRewardAttribution"("inviteeUserId");
CREATE UNIQUE INDEX "ShareRewardAttribution_workflowClaimId_key" ON "ShareRewardAttribution"("workflowClaimId");
CREATE INDEX "ShareRewardAttribution_referrerUserId_idx" ON "ShareRewardAttribution"("referrerUserId");
CREATE INDEX "ShareRewardAttribution_channel_idx" ON "ShareRewardAttribution"("channel");

CREATE UNIQUE INDEX "ShareRewardGrant_idempotencyKey_key" ON "ShareRewardGrant"("idempotencyKey");
CREATE INDEX "ShareRewardGrant_referrerUserId_grantedAt_idx" ON "ShareRewardGrant"("referrerUserId", "grantedAt");
CREATE INDEX "ShareRewardGrant_inviteeUserId_idx" ON "ShareRewardGrant"("inviteeUserId");

CREATE UNIQUE INDEX "WorkflowShareLink_token_key" ON "WorkflowShareLink"("token");
CREATE INDEX "WorkflowShareLink_sharerUserId_idx" ON "WorkflowShareLink"("sharerUserId");
CREATE INDEX "WorkflowShareLink_app_resourceId_idx" ON "WorkflowShareLink"("app", "resourceId");

CREATE UNIQUE INDEX "WorkflowShareClaim_shareLinkId_claimerUserId_key" ON "WorkflowShareClaim"("shareLinkId", "claimerUserId");
CREATE INDEX "WorkflowShareClaim_claimerUserId_idx" ON "WorkflowShareClaim"("claimerUserId");

ALTER TABLE "ShareRewardAttribution"
  ADD CONSTRAINT "ShareRewardAttribution_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareRewardAttribution"
  ADD CONSTRAINT "ShareRewardAttribution_referrerUserId_fkey"
  FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareRewardAttribution"
  ADD CONSTRAINT "ShareRewardAttribution_workflowClaimId_fkey"
  FOREIGN KEY ("workflowClaimId") REFERENCES "WorkflowShareClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShareRewardProgress"
  ADD CONSTRAINT "ShareRewardProgress_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowShareLink"
  ADD CONSTRAINT "WorkflowShareLink_sharerUserId_fkey"
  FOREIGN KEY ("sharerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowShareClaim"
  ADD CONSTRAINT "WorkflowShareClaim_shareLinkId_fkey"
  FOREIGN KEY ("shareLinkId") REFERENCES "WorkflowShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowShareClaim"
  ADD CONSTRAINT "WorkflowShareClaim_claimerUserId_fkey"
  FOREIGN KEY ("claimerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
