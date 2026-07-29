import { NextResponse } from "next/server";
import type { SmsVerificationPurpose } from "@prisma/client";
import { z } from "zod";

import { normalizePhone } from "@/lib/auth/phone";
import { verifyCaptcha } from "@/lib/auth/captcha";
import {
  issueSmsCode,
  SmsRateLimitError,
  SmsVerificationError,
} from "@/lib/auth/sms-verification-service";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(["REGISTER", "LOGIN", "BIND_PHONE", "TEAM_INVITE", "RESET_PASSWORD"]),
  inviteToken: z.string().optional(),
  captchaToken: z.string().min(1, "缺少验证码令牌"),
  captchaAnswer: z.number().int().min(0, "验证码答案无效"),
});

function clientIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const { phone, purpose, inviteToken, captchaToken, captchaAnswer } = parsed.data;

    // 1. 先校验图片验证码
    if (!verifyCaptcha(captchaToken, captchaAnswer)) {
      return NextResponse.json({ error: "验证码错误或已过期，请刷新重试" }, { status: 400 });
    }

    const phoneNorm = normalizePhone(phone);
    if (purpose === "REGISTER" && phoneNorm) {
      const existing = await prisma.user.findFirst({
        where: { phone: phoneNorm, phoneVerifiedAt: { not: null } },
      });
      if (existing?.phoneVerifiedAt) {
        return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
      }
    }

    if (purpose === "TEAM_INVITE") {
      if (!inviteToken) {
        return NextResponse.json({ error: "缺少邀请 token" }, { status: 400 });
      }
      const invite = await getInviteByToken(inviteToken);
      if (!invite || invite.status !== "PENDING") {
        return NextResponse.json({ error: "邀请无效或已过期" }, { status: 400 });
      }
    }

    const result = await issueSmsCode({
      phoneRaw: phone,
      purpose: purpose as SmsVerificationPurpose,
      sendIp: clientIp(request),
      inviteToken,
    });

    return NextResponse.json({
      ok: true,
      ...(result.mockCode ? { mockCode: result.mockCode } : {}),
    });
  } catch (e) {
    if (e instanceof SmsRateLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[sms/send]", e);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}
