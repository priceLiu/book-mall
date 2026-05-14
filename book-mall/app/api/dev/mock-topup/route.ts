import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import {
  applyMockWalletTopup,
  normalizeMockTopupAmountPoints,
  type MockTopupAmountPoints,
} from "@/lib/apply-mock-topup";

export const dynamic = "force-dynamic";

/** 模拟钱包充值；档位见 lib/apply-mock-topup.ts；开启条件见 doc/process/mock-payment-checkout.md */
export async function POST(req: Request) {
  if (!allowDevMockPaymentApis()) {
    return NextResponse.json(
      { error: "模拟充值接口未启用（开发环境或 ALLOW_MOCK_PAYMENT=true）" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let amountPoints: MockTopupAmountPoints = normalizeMockTopupAmountPoints(undefined);
  let rechargeCouponId: string | undefined;
  try {
    const body = await req.json();
    amountPoints = normalizeMockTopupAmountPoints(body?.amountPoints);
    const cid = body?.rechargeCouponId;
    if (typeof cid === "string" && cid.trim()) {
      rechargeCouponId = cid.trim();
    }
  } catch {
    /* empty / invalid JSON — default amount */
  }

  try {
    const { orderId, balanceAfterPoints, creditedTotalPoints } =
      await applyMockWalletTopup(session.user.id, amountPoints, {
        rechargeCouponId,
      });
    return NextResponse.json({
      ok: true,
      orderId,
      balanceAfterPoints,
      creditedTotalPoints,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "充值失败";
    const status =
      message.includes("不在允许范围") ||
      message.includes("优惠券") ||
      message.includes("档位") ||
      message.includes("不可同时")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
