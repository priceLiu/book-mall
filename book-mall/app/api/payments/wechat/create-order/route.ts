import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNativeOrder } from "@/lib/payments/wechat-pay-client";
import { isWechatPayConfigured } from "@/lib/payments/wechat-pay-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  checkoutId: z.string().min(1),
  amountYuan: z.number().positive(),
  description: z.string().min(1).max(42),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    if (!isWechatPayConfigured()) {
      return NextResponse.json({ error: "微信支付未配置" }, { status: 503 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const { checkoutId, amountYuan, description } = parsed.data;

    // 校验 checkout 属于当前用户且处于待支付状态
    const checkout = await prisma.paymentCheckout.findUnique({
      where: { id: checkoutId },
    });
    if (!checkout) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    if (checkout.userId !== session.user.id) {
      return NextResponse.json({ error: "无权操作此订单" }, { status: 403 });
    }
    if (checkout.status !== "PENDING") {
      return NextResponse.json({ error: "订单状态不允许支付" }, { status: 400 });
    }

    const { codeUrl } = await createNativeOrder({
      outTradeNo: checkout.outTradeNo,
      description,
      amountYuan,
    });

    return NextResponse.json({ codeUrl });
  } catch (e) {
    console.error("[wechat/create-order]", e);
    const msg = e instanceof Error ? e.message : "创建支付订单失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
