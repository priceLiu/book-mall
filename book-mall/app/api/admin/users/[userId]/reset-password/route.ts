import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateTempLoginPassword } from "@/lib/generate-temp-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: { userId: string } };

/** 管理员为用户一键重置登录密码（返回明文一次） */
export async function POST(_request: Request, context: RouteCtx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const userId = context.params.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const plain = generateTempLoginPassword(14);
  const passwordHash = await bcrypt.hash(plain, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return NextResponse.json({
    password: plain,
    email: target.email,
  });
}
