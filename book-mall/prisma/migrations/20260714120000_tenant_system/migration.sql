-- 多租户/团队体系 + Gateway 多 Key 路由（gateway-multi-credential-and-tenant）
-- 新增 Tenant/TenantMember/Seat/TenantInvite 与枚举；扩展 User、GatewayVendorCredential、GatewayRequestLog。

-- CreateEnum
CREATE TYPE "CredentialOwnerScope" AS ENUM ('USER', 'TENANT');
CREATE TYPE "TenantType" AS ENUM ('PERSONAL', 'TEAM');
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "TenantMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');
CREATE TYPE "SeatStatus" AS ENUM ('ACTIVE', 'IDLE', 'DISABLED');
CREATE TYPE "TenantInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterTable: User
ALTER TABLE "User"
  ADD COLUMN "primaryTenantId" TEXT,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: GatewayVendorCredential 多 Key 路由
ALTER TABLE "GatewayVendorCredential"
  ADD COLUMN "ownerScope" "CredentialOwnerScope" NOT NULL DEFAULT 'USER',
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isDefaultForProvider" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "GatewayVendorCredential_ownerScope_ownerId_providerKind_idx"
  ON "GatewayVendorCredential"("ownerScope", "ownerId", "providerKind");

-- AlterTable: GatewayRequestLog 租户 + 多 Key 对账快照
ALTER TABLE "GatewayRequestLog"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "actorBookUserId" TEXT,
  ADD COLUMN "credentialAliasSnapshot" TEXT,
  ADD COLUMN "channelSnapshot" TEXT;

CREATE INDEX "GatewayRequestLog_tenantId_submittedAt_idx"
  ON "GatewayRequestLog"("tenantId", "submittedAt");
CREATE INDEX "GatewayRequestLog_channelSnapshot_idx"
  ON "GatewayRequestLog"("channelSnapshot");

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "type" "TenantType" NOT NULL DEFAULT 'PERSONAL',
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "planId" TEXT,
    "packageLevel" TEXT,
    "interval" "MembershipInterval",
    "seatLimit" INTEGER NOT NULL DEFAULT 1,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 2,
    "perSeatCapCredits" INTEGER,
    "currentPeriodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Tenant_ownerUserId_idx" ON "Tenant"("ownerUserId");
CREATE INDEX "Tenant_type_status_idx" ON "Tenant"("type", "status");

-- CreateTable: Seat
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT,
    "status" "SeatStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Seat_tenantId_status_idx" ON "Seat"("tenantId", "status");

-- CreateTable: TenantMember
CREATE TABLE "TenantMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "status" "TenantMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "seatId" TEXT,
    "monthlyCapCredits" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantMember_seatId_key" ON "TenantMember"("seatId");
CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "TenantMember"("tenantId", "userId");
CREATE INDEX "TenantMember_tenantId_status_idx" ON "TenantMember"("tenantId", "status");
CREATE INDEX "TenantMember_userId_idx" ON "TenantMember"("userId");

-- CreateTable: TenantInvite
CREATE TABLE "TenantInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "status" "TenantInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantInvite_token_key" ON "TenantInvite"("token");
CREATE INDEX "TenantInvite_tenantId_status_idx" ON "TenantInvite"("tenantId", "status");
CREATE INDEX "TenantInvite_email_idx" ON "TenantInvite"("email");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_seatId_fkey"
  FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
