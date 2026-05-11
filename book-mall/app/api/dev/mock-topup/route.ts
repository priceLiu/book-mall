import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import {
  applyMockWalletTopup,
  normalizeMockTopupAmountMinor,
  type MockTopupAmountMinor,
} from "@/lib/apply-mock-topup";

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

  let amountMinor: MockTopupAmountMinor = normalizeMockTopupAmountMinor(undefined);
  try {
    const body = await req.json();
    amountMinor = normalizeMockTopupAmountMinor(body?.amountMinor);
  } catch {
    /* empty / invalid JSON — default amount */
  }

  try {
    const { orderId, balanceAfterMinor } = await applyMockWalletTopup(
      session.user.id,
      amountMinor,
    );
    return NextResponse.json({ ok: true, orderId, balanceAfterMinor });
  } catch (e) {
    const message = e instanceof Error ? e.message : "充值失败";
    const status = message.includes("档位") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
