import { randomInt } from "crypto";

import type { SmsVerificationPurpose } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  isMockSmsPhone,
  isTestPrefixPhone,
  MOCK_SMS_CODE,
  normalizePhone,
} from "@/lib/auth/phone";
import {
  generateInviteBypassCode,
  verifySmsBypass,
} from "@/lib/auth/sms-bypass";
import { prisma } from "@/lib/prisma";
import { sendSmsMessage } from "@/lib/sms/send-sms";

const CODE_TTL_MS = 5 * 60 * 1000;
/** 团队邀请链接内验证码与 TenantInvite 同 TTL（7 天） */
const TEAM_INVITE_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function codeTtlMs(purpose: SmsVerificationPurpose): number {
  return purpose === "TEAM_INVITE" ? TEAM_INVITE_CODE_TTL_MS : CODE_TTL_MS;
}
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_DAILY_PER_PHONE = 10;
const MAX_DAILY_PER_IP = 30;
const MAX_VERIFY_ATTEMPTS = 5;

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export class SmsRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsRateLimitError";
  }
}

export class SmsVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsVerificationError";
  }
}

export async function issueSmsCode(input: {
  phoneRaw: string;
  purpose: SmsVerificationPurpose;
  sendIp?: string | null;
  inviteToken?: string | null;
}): Promise<{ code: string; mockCode?: string }> {
  const phone = normalizePhone(input.phoneRaw);
  if (!phone) throw new SmsVerificationError("手机号格式无效");

  const now = new Date();
  const dayStart = startOfUtcDay(now);

  if (isTestPrefixPhone(phone)) {
    const code = generateInviteBypassCode();
    await sendSmsMessage({
      phone,
      purpose: input.purpose,
      code,
      inviteToken: input.inviteToken ?? undefined,
    });
    return { code };
  }

  const recent = await prisma.smsVerification.findFirst({
    where: {
      phone,
      purpose: input.purpose,
      createdAt: { gt: new Date(now.getTime() - SEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    throw new SmsRateLimitError("发送过于频繁，请 60 秒后再试");
  }

  const phoneDayCount = await prisma.smsVerification.count({
    where: { phone, createdAt: { gte: dayStart } },
  });
  if (phoneDayCount >= MAX_DAILY_PER_PHONE) {
    throw new SmsRateLimitError("该手机号今日验证码次数已达上限");
  }

  if (input.sendIp) {
    const ipDayCount = await prisma.smsVerification.count({
      where: { sendIp: input.sendIp, createdAt: { gte: dayStart } },
    });
    if (ipDayCount >= MAX_DAILY_PER_IP) {
      throw new SmsRateLimitError("请求过于频繁，请稍后再试");
    }
  }

  const code = isMockSmsPhone(phone) ? MOCK_SMS_CODE : generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now.getTime() + codeTtlMs(input.purpose));

  await prisma.smsVerification.create({
    data: {
      phone,
      purpose: input.purpose,
      codeHash,
      inviteToken: input.inviteToken?.trim() || null,
      expiresAt,
      sendIp: input.sendIp ?? null,
    },
  });

  await sendSmsMessage({
    phone,
    purpose: input.purpose,
    code,
    inviteToken: input.inviteToken ?? undefined,
  });

  const result: { code: string; mockCode?: string } = { code };
  if (isMockSmsPhone(phone) && process.env.NODE_ENV !== "production") {
    result.mockCode = code;
  }
  return result;
}

/** 团队邀请链接中的 code 是否仍有效（未消费、未过期、与 token 绑定）。 */
export async function isTeamInviteUrlCodeValid(input: {
  phoneRaw: string;
  inviteToken: string;
  code: string;
}): Promise<boolean> {
  const phone = normalizePhone(input.phoneRaw);
  const code = input.code.trim();
  if (!phone || !code) return false;

  if (verifySmsBypass({ phoneNormalized: phone, code })) {
    return true;
  }

  const invite = await prisma.tenantInvite.findUnique({
    where: { token: input.inviteToken.trim() },
    select: { phone: true, urlCode: true, status: true, expiresAt: true },
  });
  if (
    invite &&
    invite.status === "PENDING" &&
    invite.expiresAt > new Date() &&
    normalizePhone(invite.phone) === phone &&
    invite.urlCode?.trim() === code
  ) {
    return true;
  }

  if (!/^\d{6}$/.test(code)) return false;

  const row = await prisma.smsVerification.findFirst({
    where: {
      phone,
      purpose: "TEAM_INVITE",
      inviteToken: input.inviteToken.trim(),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return false;
  return bcrypt.compare(code, row.codeHash);
}

export async function verifySmsCode(input: {
  phoneRaw: string;
  purpose: SmsVerificationPurpose;
  code: string;
  inviteToken?: string | null;
  consume?: boolean;
}): Promise<void> {
  const phone = normalizePhone(input.phoneRaw);
  if (!phone) throw new SmsVerificationError("手机号格式无效");
  const code = input.code.trim();

  if (verifySmsBypass({ phoneNormalized: phone, code })) {
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    throw new SmsVerificationError("验证码格式无效");
  }

  if (input.purpose === "TEAM_INVITE" && input.inviteToken?.trim()) {
    const invite = await prisma.tenantInvite.findUnique({
      where: { token: input.inviteToken.trim() },
      select: { phone: true, urlCode: true, status: true, expiresAt: true },
    });
    if (
      invite &&
      invite.status === "PENDING" &&
      invite.expiresAt > new Date() &&
      normalizePhone(invite.phone) === phone &&
      invite.urlCode?.trim() === code
    ) {
      return;
    }
  }

  const row = await prisma.smsVerification.findFirst({
    where: {
      phone,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(input.inviteToken
        ? { inviteToken: input.inviteToken.trim() }
        : { inviteToken: null }),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!row) throw new SmsVerificationError("验证码无效或已过期");

  if (row.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    throw new SmsVerificationError("验证码错误次数过多，请重新获取");
  }

  const ok = await bcrypt.compare(code, row.codeHash);
  if (!ok) {
    await prisma.smsVerification.update({
      where: { id: row.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new SmsVerificationError("验证码错误");
  }

  if (input.consume !== false) {
    await prisma.smsVerification.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
  }
}
