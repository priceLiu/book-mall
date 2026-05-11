import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 开发环境模拟钱包充值（不走真实支付渠道） */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "仅开发环境可用" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const amountMinor = 100_00;

  const orderId = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: session.user.id },
    });
    const next = wallet.balanceMinor + amountMinor;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: next },
    });
    const order = await tx.order.create({
      data: {
        userId: session.user.id,
        type: "WALLET_TOPUP",
        status: "PAID",
        amountMinor,
        paidAt: new Date(),
        meta: { mock: true },
      },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountMinor,
        balanceAfterMinor: next,
        description: "开发模拟充值 ¥100",
        orderId: order.id,
      },
    });
    return order.id;
  });

  return NextResponse.json({ ok: true, orderId });
}
