import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeEmail } from "@/lib/auth/normalize-email";
import { maskPhone, normalizePhone } from "@/lib/auth/phone";
import { bumpSessionVersion } from "@/lib/auth-session-version";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().min(3, "请输入邮箱"),
  phone: z.string().min(1, "请输入手机号"),
});

/**
 * 老邮箱用户自助绑定手机号（无需登录）。
 * 校验邮箱对应账号尚未完成手机验证，绑定后须重新登录。
 */
export async function POST(request: Request) {
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

    const email = normalizeEmail(parsed.data.email);
    if (!email) {
      return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 });
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
      select: {
        id: true,
        email: true,
        phoneVerifiedAt: true,
        phone: true,
      },
    });

    if (!user?.email) {
      return NextResponse.json(
        { error: "未找到该邮箱账号，或已完成手机号绑定" },
        { status: 404 },
      );
    }

    if (user.phoneVerifiedAt) {
      return NextResponse.json(
        { error: "该账号已绑定手机号，请直接使用手机号登录" },
        { status: 409 },
      );
    }

    const taken = await prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: user.id },
        phoneVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "该手机号已被其他账号使用" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    try {
      await bumpSessionVersion(user.id);
    } catch {
      /* non-fatal */
    }

    try {
      await ensureBookUserGatewayIdentitySynced(user.id);
    } catch (e) {
      console.warn("[legacy-email-bind-phone] gateway sync failed", e);
    }

    return NextResponse.json({
      ok: true,
      phone,
      phoneMasked: maskPhone(phone),
    });
  } catch (e) {
    console.error("[legacy-email-bind-phone]", e);
    return NextResponse.json({ error: "绑定失败，请稍后重试" }, { status: 500 });
  }
}
