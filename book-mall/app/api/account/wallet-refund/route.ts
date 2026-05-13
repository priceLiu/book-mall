import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requestedAmountMinor: z.number().int().positive().nullable().optional(),
  userNote: z.string().max(2000).optional(),
});

/** 用户发起余额退款申请（6.3） */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const pending = await prisma.walletRefundRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
  });
  if (pending) {
    return NextResponse.json({ error: "您已有待审核的余额退款申请" }, { status: 409 });
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: session.user.id },
  });
  if (!wallet || wallet.balanceMinor <= 0) {
    return NextResponse.json({ error: "无可退余额" }, { status: 400 });
  }

  const reqMinor = parsed.data.requestedAmountMinor;
  if (reqMinor != null && reqMinor > wallet.balanceMinor) {
    return NextResponse.json({ error: "申请金额超过可用余额" }, { status: 400 });
  }

  await prisma.walletRefundRequest.create({
    data: {
      userId: session.user.id,
      requestedAmountMinor: reqMinor ?? null,
      userNote: parsed.data.userNote?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
