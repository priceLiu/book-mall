import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateTempLoginPassword } from "@/lib/generate-temp-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 管理员一键重置自己的登录密码（返回明文一次，请妥善保存） */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const plain = generateTempLoginPassword(14);
  const passwordHash = await bcrypt.hash(plain, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ password: plain });
}
