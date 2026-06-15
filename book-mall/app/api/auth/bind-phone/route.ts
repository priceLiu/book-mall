import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { isValidSmsCodeInput } from "@/lib/auth/sms-bypass";
import {
  SmsVerificationError,
  verifySmsCode,
} from "@/lib/auth/sms-verification-service";
import { prisma } from "@/lib/prisma";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(1),
  code: z.string().refine(isValidSmsCodeInput, "验证码格式无效"),
  password: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ??
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
        "参数无效";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: { phone, NOT: { id: session.user.id } },
    });
    if (taken?.phoneVerifiedAt) {
      return NextResponse.json({ error: "该手机号已被其他账号使用" }, { status: 409 });
    }

    await verifySmsCode({
      phoneRaw: phone,
      purpose: "BIND_PHONE",
      code: parsed.data.code,
    });

    const data: {
      phone: string;
      phoneVerifiedAt: Date;
      passwordHash?: string;
    } = {
      phone,
      phoneVerifiedAt: new Date(),
    };

    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    try {
      await ensureBookUserGatewayIdentitySynced(session.user.id);
    } catch (e) {
      console.warn("[bind-phone] gateway identity sync failed", e);
    }

    return NextResponse.json({ ok: true, phone });
  } catch (e) {
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[bind-phone]", e);
    return NextResponse.json({ error: "绑定失败，请稍后重试" }, { status: 500 });
  }
}
