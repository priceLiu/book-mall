import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { maskPhone, normalizePhone } from "@/lib/auth/phone";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: { userId: string } };

const schema = z.object({
  phone: z.string().min(1, "请输入手机号"),
});

/** 管理员为老用户补录手机号（跳过短信验证，直接标记 phoneVerifiedAt） */
export async function POST(request: Request, context: RouteCtx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const userId = context.params.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.phone?.[0] ?? "参数无效" },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, phoneVerifiedAt: true },
  });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const taken = await prisma.user.findFirst({
    where: { phone, NOT: { id: userId }, phoneVerifiedAt: { not: null } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "该手机号已被其他账号使用" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      phone,
      phoneVerifiedAt: new Date(),
    },
  });

  try {
    await ensureBookUserGatewayIdentitySynced(userId);
  } catch (e) {
    console.warn("[admin/bind-phone] gateway identity sync failed", e);
  }

  return NextResponse.json({
    ok: true,
    phone,
    phoneMasked: maskPhone(phone),
    previousPhone: target.phone,
    wasVerified: Boolean(target.phoneVerifiedAt),
  });
}
