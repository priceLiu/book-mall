import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { phone } = (await request.json()) as { phone?: string };
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) {
      return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone: phoneNorm },
      select: { phoneVerifiedAt: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false, hint: "该手机号未注册，请先注册" });
    }

    if (!user.phoneVerifiedAt) {
      return NextResponse.json({ exists: true, verified: false, hint: "该手机号尚未验证，请先完成验证" });
    }

    return NextResponse.json({
      exists: true,
      verified: true,
      hasPassword: !!user.passwordHash,
      hint: user.passwordHash ? undefined : "该账号未设置密码，请使用验证码登录",
    });
  } catch {
    return NextResponse.json({ error: "检查失败" }, { status: 500 });
  }
}
