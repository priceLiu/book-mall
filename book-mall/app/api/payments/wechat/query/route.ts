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

    // 如果微信侧已支付但本地还没履约，执行履约（发放积分等）
    if (result.tradeState === "SUCCESS" && checkout.status !== "PAID") {
      const { fulfillPaymentCheckout } = await import("@/lib/payments/fulfill-checkout");
      await fulfillPaymentCheckout({
        checkoutId: checkout.id,
        confirmMode: "ADMIN_INSTANT",
        confirmedByUserId: session.user.id,
        adminNote: `微信支付查询确认: ${result.transactionId}`,
      });
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
