import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOrder } from "@/lib/payments/wechat-pay-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const url = new URL(request.url);
    const checkoutId = url.searchParams.get("checkoutId");
    if (!checkoutId) {
      return NextResponse.json({ error: "缺少 checkoutId" }, { status: 400 });
    }

    const checkout = await prisma.paymentCheckout.findUnique({
      where: { id: checkoutId },
    });
    if (!checkout || checkout.userId !== session.user.id) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    const result = await queryOrder(checkout.outTradeNo);

    // 如果微信侧已支付但本地还没更新，主动更新
    if (result.tradeState === "SUCCESS" && checkout.status !== "PAID") {
      await prisma.paymentCheckout.update({
        where: { id: checkout.id },
        data: {
          status: "PAID",
          confirmMode: "ADMIN_INSTANT",
          adminNote: `主动查询确认: ${result.transactionId}`,
          paidAt: new Date(),
        },
      });
      const { fulfillPaymentCheckout } = await import("@/lib/payments/fulfill-checkout");
      await fulfillPaymentCheckout(checkout.id);
    }

    return NextResponse.json({
      tradeState: result.tradeState,
      tradeStateDesc: result.tradeStateDesc,
      transactionId: result.transactionId,
      paid: result.tradeState === "SUCCESS",
    });
  } catch (e) {
    console.error("[wechat/query]", e);
    const msg = e instanceof Error ? e.message : "查询失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
