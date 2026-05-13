import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email("邮箱格式无效"),
  password: z.string().min(8, "密码至少 8 位"),
  name: z.string().max(64).optional(),
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

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: parsed.data.name?.trim() || null,
        },
      });
      await tx.wallet.create({
        data: { userId: user.id },
      });
    });

    await prisma.platformConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[register]", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "该邮箱已注册" },
          { status: 409 },
        );
      }
    }

    const message = e instanceof Error ? e.message : "未知错误";
    const ret: { error: string; detail?: string } = {
      error: "注册失败，请稍后重试",
    };
    if (isDev()) {
      ret.detail = message;
      const dbUnreachable =
        message.includes("P1001") ||
        message.includes("Can't reach database") ||
        message.toLowerCase().includes("reach database");
      if (dbUnreachable) {
        ret.error = "无法连接数据库";
        ret.detail =
          "请确认 .env.local 中 DATABASE_URL 正确、本机网络可达 Neon，并在控制台唤醒项目；可运行 pnpm run db:deploy 测试连接。";
      }
    }

    return NextResponse.json(ret, { status: 500 });
  }
}
