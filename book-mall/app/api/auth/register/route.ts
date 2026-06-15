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
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { prisma } from "@/lib/prisma";
import { getInviteByToken } from "@/lib/tenant/tenant-invite-service";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  phone: z.string().min(1),
  code: z.string().refine(isValidSmsCodeInput, "验证码格式无效"),
  password: z.string().min(8, "密码至少 8 位"),
  name: z.string().max(64).optional(),
  billingPersona: z.enum(["PLATFORM_CREDIT", "BYOK"]),
  inviteToken: z.string().min(1).optional(),
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

    await verifySmsCode({
      phoneRaw: phone,
      purpose: inviteToken ? "TEAM_INVITE" : "REGISTER",
      code: parsed.data.code,
      inviteToken,
    });

    const billingPersona = parsed.data.billingPersona as BillingPersona;
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing?.phoneVerifiedAt) {
      return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const lockedAt = new Date();
    const verifiedAt = new Date();

    let createdUserId: string | null = null;
    await prisma.$transaction(async (tx) => {
      if (existing) {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            phone,
            phoneVerifiedAt: verifiedAt,
            passwordHash,
            name: parsed.data.name?.trim() || existing.name,
            billingPersona,
            billingPersonaLockedAt: lockedAt,
            ecomBillingMode: deriveEcomBillingMode(billingPersona),
          },
        });
        createdUserId = user.id;
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          await tx.wallet.create({ data: { userId: user.id } });
        }
      } else {
        const user = await tx.user.create({
          data: {
            phone,
            phoneVerifiedAt: verifiedAt,
            passwordHash,
            name: parsed.data.name?.trim() || null,
            billingPersona,
            billingPersonaLockedAt: lockedAt,
            ecomBillingMode: deriveEcomBillingMode(billingPersona),
          },
        });
        createdUserId = user.id;
        await tx.wallet.create({ data: { userId: user.id } });
      }
    });

    if (createdUserId) {
      try {
        await ensureBookUserGatewayIdentitySynced(createdUserId);
        if (billingPersona === "PLATFORM_CREDIT") {
          await ensurePlatformManagedKeyForUser(createdUserId);
        }
      } catch (syncErr) {
        console.warn("[register] gateway sync failed", syncErr);
      }
    }

    await prisma.platformConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });

    return NextResponse.json({ ok: true, billingPersona, phone });
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
