-- 短信发送审计日志（管理后台）

CREATE TYPE "SmsSendStatus" AS ENUM ('SUCCESS', 'MOCK', 'FAILED', 'RATE_LIMITED');

CREATE TABLE "SmsSendLog" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "SmsVerificationPurpose" NOT NULL,
    "code" TEXT,
    "source" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "SmsSendStatus" NOT NULL,
    "provider" TEXT,
    "templateId" TEXT,
    "sendIp" TEXT,
    "userAgent" TEXT,
    "inviteToken" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "detailJson" JSONB,
    "verificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsSendLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SmsSendLog_createdAt_idx" ON "SmsSendLog"("createdAt");
CREATE INDEX "SmsSendLog_phone_createdAt_idx" ON "SmsSendLog"("phone", "createdAt");
CREATE INDEX "SmsSendLog_status_createdAt_idx" ON "SmsSendLog"("status", "createdAt");
CREATE INDEX "SmsSendLog_source_createdAt_idx" ON "SmsSendLog"("source", "createdAt");
