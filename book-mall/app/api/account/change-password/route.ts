import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(8, "新密码至少 8 位"),
  confirmNewPassword: z.string().min(8, "请确认新密码"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.newPassword?.[0] ??
      parsed.error.flatten().fieldErrors.currentPassword?.[0] ??
      parsed.error.flatten().fieldErrors.confirmNewPassword?.[0] ??
      "参数无效";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmNewPassword } = parsed.data;
  if (newPassword !== confirmNewPassword) {
    return NextResponse.json({ error: "两次输入的新密码不一致" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json(
      {
        error:
          "当前账号未设置邮箱密码（例如仅使用第三方登录），无法通过此方式修改。请联系管理员重置密码。",
      },
      { status: 400 },
    );
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
