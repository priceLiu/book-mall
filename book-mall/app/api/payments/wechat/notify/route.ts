import { NextResponse } from "next/server";
import { decryptNotifyResource, verifyNotifySignature } from "@/lib/payments/wechat-pay-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface WxNotifyBody {
  id: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
    original_type: string;
  };
}

interface WxTransaction {
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  trade_state_desc: string;
  amount: { total: number; payer_total: number; currency: string };
  success_time?: string;
}

export async function POST(request: Request) {
  const body = await request.text();
  const timestamp = request.headers.get("wechatpay-timestamp") ?? "";
  const nonce = request.headers.get("wechatpay-nonce") ?? "";
  const signature = request.headers.get("wechatpay-signature") ?? "";
  const serial = request.headers.get("wechatpay-serial") ?? "";

  // 验签
  if (!(await verifyNotifySignature(timestamp, nonce, body, signature, serial))) {
    console.error("[wechat/notify] 签名验证失败");
    return new NextResponse("SIGNATURE_ERROR", { status: 401 });
  }

  let notify: WxNotifyBody;
  try {
    notify = JSON.parse(body);
  } catch {
    return new NextResponse("INVALID_BODY", { status: 400 });
  }

  // 只处理支付成功通知
  if (notify.event_type !== "TRANSACTION.SUCCESS") {
    return new NextResponse("OK", { status: 200 });
  }

  // 解密 resource
  const { associated_data, nonce: resNonce, ciphertext } = notify.resource;
  let transaction: WxTransaction;
  try {
    transaction = decryptNotifyResource(associated_data, resNonce, ciphertext) as WxTransaction;
  } catch (e) {
    console.error("[wechat/notify] 解密失败", e);
    return new NextResponse("DECRYPT_ERROR", { status: 500 });
  }

  const outTradeNo = transaction.out_trade_no;

  try {
    // 幂等处理：查找 checkout
    const checkout = await prisma.paymentCheckout.findUnique({
      where: { outTradeNo },
    });

    if (!checkout) {
      console.error(`[wechat/notify] checkout 不存在: ${outTradeNo}`);
      return new NextResponse("OK", { status: 200 });
    }

    if (checkout.status === "PAID") {
      return new NextResponse("OK", { status: 200 }); // 已处理，幂等返回
    }

    // 执行履约（发放积分/会员等）—— fulfillPaymentCheckout 内部会在事务中更新状态
    const { fulfillPaymentCheckout } = await import("@/lib/payments/fulfill-checkout");
    await fulfillPaymentCheckout({
      checkoutId: checkout.id,
      confirmMode: "ADMIN_INSTANT",
      confirmedByUserId: checkout.userId,
      adminNote: `微信支付回调: ${transaction.transaction_id}`,
    });

    console.log(`[wechat/notify] 支付成功: ${outTradeNo} → ${transaction.transaction_id}`);
  } catch (e) {
    console.error(`[wechat/notify] 处理失败: ${outTradeNo}`, e);
    // 仍返回 200，避免微信重复推送
  }

  return new NextResponse("OK", { status: 200 });
}
