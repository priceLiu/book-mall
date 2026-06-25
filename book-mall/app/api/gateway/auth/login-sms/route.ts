import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@prisma/client";
import { z } from "zod";
import {
  getGatewayJwtTtlSec,
  requireGatewayJwtSecret,
} from "@/lib/gateway/env";
import { signGatewayAccessToken } from "@/lib/gateway/gateway-sso-token";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { normalizePhone } from "@/lib/auth/phone";
import {
  verifySmsCode,
  SmsVerificationError,
} from "@/lib/auth/sms-verification-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
});

/**
 * Gateway 手机号 + 短信验证码登录（验证码登录即自动创建账号）。
 * - 手机号已是 Book 用户 → 关联其 Gateway 身份（拿到套餐/凭证关联）。
 * - 否则按 `{phone}@phone.book` 创建/复用一个 LOCAL GatewayUser。
 */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const phoneNorm = normalizePhone(parsed.data.phone);
  if (!phoneNorm) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  try {
    await verifySmsCode({
      phoneRaw: parsed.data.phone,
      purpose: "LOGIN",
      code: parsed.data.code,
      consume: true,
    });
  } catch (e) {
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[gateway/login-sms] verify failed", e);
    return NextResponse.json({ error: "验证码校验失败" }, { status: 500 });
  }

  let gwUser: GatewayUser;
  try {
    const bookUser = await prisma.user.findFirst({
      where: { phone: phoneNorm },
      orderBy: { phoneVerifiedAt: "desc" },
      select: { id: true },
    });
    if (bookUser) {
      gwUser = await ensureBookUserGatewayIdentitySynced(bookUser.id);
    } else {
      const email = `${phoneNorm}@phone.book`;
      gwUser = await prisma.gatewayUser.upsert({
        where: { email },
        create: { email, source: "LOCAL" },
        update: {},
      });
    }
  } catch (e) {
    console.error("[gateway/login-sms] resolve user failed", e);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }

  let secret: string;
  try {
    secret = requireGatewayJwtSecret();
  } catch (e) {
    console.error("[gateway/login-sms] GATEWAY_JWT_SECRET missing/invalid", e);
    return NextResponse.json(
      { error: "Gateway 签名密钥未配置" },
      { status: 503 },
    );
  }

  const expiresIn = getGatewayJwtTtlSec();
  const token = signGatewayAccessToken({
    gatewayUserId: gwUser.id,
    secret,
    expiresInSec: expiresIn,
    profile: { email: gwUser.email, name: gwUser.name, image: gwUser.image },
  });

  const res = NextResponse.json({
    ok: true,
    access_token: token,
    expires_in: expiresIn,
    user: { id: gwUser.id, email: gwUser.email, name: gwUser.name },
  });
  res.cookies.set("gateway_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
