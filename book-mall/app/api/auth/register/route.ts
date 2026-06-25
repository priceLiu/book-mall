import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { BillingPersona } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizePhone } from "@/lib/auth/phone";
import { isValidSmsCodeInput } from "@/lib/auth/sms-bypass";
import {
  SmsVerificationError,
  verifySmsCode,
} from "@/lib/auth/sms-verification-service";
import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";
import { prisma } from "@/lib/prisma";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";
import { resolveReferrerByCode } from "@/lib/referral/referral-service";
import { issueAutoLoginToken } from "@/lib/auth/auto-login-token";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  phone: z.string().min(1),
  code: z.string().refine(isValidSmsCodeInput, "验证码格式无效"),
  // 分享链接免密注册时可省略密码（后续可用短信 OTP 登录或在设置中补设密码）。
  password: z.string().min(8, "密码至少 8 位").optional(),
  name: z.string().max(64).optional(),
  billingPersona: z.enum(["PLATFORM_CREDIT", "BYOK"]).optional(),
  inviteToken: z.string().min(1).optional(),
  /// 分享码（来自 /r/{code} 链接），用于注册归因
  referralCode: z.string().min(1).max(32).optional(),
});

function isDev() {
  return process.env.NODE_ENV === "development";
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
    }

    const inviteToken = parsed.data.inviteToken?.trim() || undefined;
    if (inviteToken) {
      const invite = await getInviteByToken(inviteToken);
      if (!invite || invite.status !== "PENDING") {
        return NextResponse.json({ error: "邀请已失效" }, { status: 400 });
      }
      if (invite.phone !== phone) {
        return NextResponse.json({ error: "手机号与邀请不一致" }, { status: 400 });
      }
    }

    const referralCode = parsed.data.referralCode?.trim() || undefined;
    // 分享链接注册：允许免密码（password 可省）。其余注册仍要求密码。
    if (!referralCode && !parsed.data.password) {
      return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
    }

    await verifySmsCode({
      phoneRaw: phone,
      purpose: inviteToken ? "TEAM_INVITE" : "REGISTER",
      code: parsed.data.code,
      inviteToken,
    });

    // 分享链接注册默认平台代付；普通注册保留用户所选 persona。
    const billingPersona = (parsed.data.billingPersona ??
      "PLATFORM_CREDIT") as BillingPersona;
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing?.phoneVerifiedAt) {
      return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
    }

    // 解析分享归因：仅在分享码有效且非自荐时记录 referredByUserId（仅新建用户写入）。
    let referredByUserId: string | null = null;
    if (referralCode) {
      const referrer = await resolveReferrerByCode(referralCode);
      if (referrer && referrer.referrerUserId !== existing?.id) {
        referredByUserId = referrer.referrerUserId;
      }
    }

    const passwordHash = parsed.data.password
      ? await bcrypt.hash(parsed.data.password, 12)
      : null;
    const lockedAt = new Date();
    const verifiedAt = new Date();

    const createdUserId = await prisma.$transaction(async (tx) => {
      if (existing) {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            phone,
            phoneVerifiedAt: verifiedAt,
            // 仅在用户设置了密码时更新密码，避免清空历史密码
            ...(passwordHash ? { passwordHash } : {}),
            name: parsed.data.name?.trim() || existing.name,
            billingPersona,
            billingPersonaLockedAt: lockedAt,
            ecomBillingMode: deriveEcomBillingMode(billingPersona),
            // 仅在尚未归因时写入分享上线
            ...(referredByUserId && !existing.referredByUserId
              ? { referredByUserId }
              : {}),
          },
        });
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          await tx.wallet.create({ data: { userId: user.id } });
        }
        return user.id;
      }
      const user = await tx.user.create({
        data: {
          phone,
          phoneVerifiedAt: verifiedAt,
          passwordHash,
          name: parsed.data.name?.trim() || null,
          billingPersona,
          billingPersonaLockedAt: lockedAt,
          ecomBillingMode: deriveEcomBillingMode(billingPersona),
          ...(referredByUserId ? { referredByUserId } : {}),
        },
      });
      await tx.wallet.create({ data: { userId: user.id } });
      return user.id;
    });

    // Gateway 身份 / sk-gw 在首次 SSO 或生成时懒加载（见 sync-user / platform-managed-key），
    // 不在注册热路径阻塞，避免注册 + 登录连续等待 2～3 秒。

    // 免密注册场景：返回一次性自动登录票据，客户端据此建立会话（无需二次短信）。
    const autoLoginToken = issueAutoLoginToken(createdUserId);

    return NextResponse.json({
      ok: true,
      billingPersona,
      phone,
      passwordless: !passwordHash,
      autoLoginToken,
    });
  } catch (e) {
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[register]", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
    }

    const message = e instanceof Error ? e.message : "未知错误";
    const ret: { error: string; detail?: string } = {
      error: "注册失败，请稍后重试",
    };
    if (isDev()) ret.detail = message;
    return NextResponse.json(ret, { status: 500 });
  }
}

/** bind-phone 在同文件导出供 route 复用 — 实际 route 在 bind-phone/route.ts */
