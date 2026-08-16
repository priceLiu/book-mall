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

// ─── code_url 内存缓存（避免 FREQUENCY_LIMITED） ─────────
// 微信 Native 支付 code_url 有效期 2 小时，同一 out_trade_no 重复创建会报错
interface CachedCodeUrl {
  codeUrl: string;
  expiresAt: number;
}
const codeUrlCache = new Map<string, CachedCodeUrl>();
const CODE_URL_TTL_MS = 2 * 60 * 60 * 1000; // 2 小时

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

    // 1. 检查内存缓存：同一 out_trade_no 的 code_url 在 2 小时内有效
    const cached = codeUrlCache.get(checkout.outTradeNo);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({ codeUrl: cached.codeUrl });
    }

    // 2. 调用微信 API 创建订单
    try {
      const { codeUrl } = await createNativeOrder({
        outTradeNo: checkout.outTradeNo,
        description,
        amountYuan,
      });

      // 缓存 code_url
      codeUrlCache.set(checkout.outTradeNo, {
        codeUrl,
        expiresAt: Date.now() + CODE_URL_TTL_MS,
      });

      // 清理过期缓存条目
      if (codeUrlCache.size > 200) {
        const now = Date.now();
        for (const [key, val] of codeUrlCache) {
          if (now >= val.expiresAt) codeUrlCache.delete(key);
        }
      }

      return NextResponse.json({ codeUrl });
    } catch (e) {
      // 如果是频率限制错误，尝试返回缓存（可能刚被另一个请求创建）
      if (e instanceof Error && e.message.includes("FREQUENCY_LIMITED")) {
        const retryCached = codeUrlCache.get(checkout.outTradeNo);
        if (retryCached) {
          return NextResponse.json({ codeUrl: retryCached.codeUrl });
        }
      }
      throw e;
    }
  } catch (e) {
    console.error("[wechat/create-order]", e);
    const msg = e instanceof Error ? e.message : "创建支付订单失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
