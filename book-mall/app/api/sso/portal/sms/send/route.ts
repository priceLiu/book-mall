import { NextResponse } from "next/server";
import type { SmsVerificationPurpose } from "@prisma/client";
import { z } from "zod";

import { normalizePhone } from "@/lib/auth/phone";
import {
  issueSmsCode,
  SmsRateLimitError,
  SmsVerificationError,
} from "@/lib/auth/sms-verification-service";
import { withApiDbGuard } from "@/lib/http/api-db-error";
import { prisma } from "@/lib/prisma";
import { toolsExchangeAuthorized } from "@/lib/sso-tools-env";
import { portalClientIpFromRequest } from "@/lib/site-traffic/client-ip";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(["REGISTER", "LOGIN"]),
});

/**
 * 门户 BFF 专用短信发送（Bearer TOOLS_SSO_SERVER_SECRET）。
 * 子应用服务端已鉴权，无需浏览器侧图形验证码。
 */
export const POST = withApiDbGuard(async (request) => {
  if (!toolsExchangeAuthorized(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const { phone, purpose } = parsed.data;
    const phoneNorm = normalizePhone(phone);
    if (purpose === "REGISTER" && phoneNorm) {
      const existing = await prisma.user.findFirst({
        where: { phone: phoneNorm, phoneVerifiedAt: { not: null } },
      });
      if (existing?.phoneVerifiedAt) {
        return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
      }
    }

    const result = await issueSmsCode({
      phoneRaw: phone,
      purpose: purpose as SmsVerificationPurpose,
      sendIp: portalClientIpFromRequest(request),
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
    console.error("[portal/sms/send]", e);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
});
