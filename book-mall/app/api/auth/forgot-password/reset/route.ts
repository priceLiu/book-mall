import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { normalizePhone } from "@/lib/auth/phone";
import { verifySmsCode, SmsVerificationError } from "@/lib/auth/sms-verification-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
  newPassword: z.string().min(6, "密码至少 6 位"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "参数无效" }, { status: 400 });
    }

    const { phone, code, newPassword } = parsed.data;
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) {
      return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
    }

    // 校验短信验证码（RESET_PASSWORD 用途）
    await verifySmsCode({
      phoneRaw: phone,
      purpose: "RESET_PASSWORD",
      code,
      consume: true,
    });

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { phone: phoneNorm },
    });
    if (!user) {
      return NextResponse.json({ error: "该手机号未注册" }, { status: 404 });
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SmsVerificationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[forgot-password/reset]", e);
    return NextResponse.json({ error: "重置失败，请稍后重试" }, { status: 500 });
  }
}
