-- Phone auth: User.phone, SmsVerification, TenantInvite.phone

-- User phone fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- Expire legacy email-based pending invites
UPDATE "TenantInvite" SET "status" = 'EXPIRED' WHERE "status" = 'PENDING';

-- TenantInvite: email -> phone
DROP INDEX IF EXISTS "TenantInvite_email_idx";
ALTER TABLE "TenantInvite" DROP COLUMN IF EXISTS "email";
ALTER TABLE "TenantInvite" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TenantInvite" ALTER COLUMN "phone" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "TenantInvite_phone_idx" ON "TenantInvite"("phone");

-- SmsVerificationPurpose enum
DO $$ BEGIN
  CREATE TYPE "SmsVerificationPurpose" AS ENUM ('REGISTER', 'LOGIN', 'BIND_PHONE', 'TEAM_INVITE', 'RESET_PASSWORD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SmsVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "SmsVerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "inviteToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "sendIp" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsVerification_phone_purpose_createdAt_idx" ON "SmsVerification"("phone", "purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "SmsVerification_expiresAt_idx" ON "SmsVerification"("expiresAt");
