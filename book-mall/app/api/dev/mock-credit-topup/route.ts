import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import {
  applyMockCreditTopup,
  type CreditTopupTarget,
} from "@/lib/billing/apply-mock-credit-topup";
import { ALL_CREDIT_TOPUP_PACKS } from "@/lib/billing/credit-topup-packs";

export const dynamic = "force-dynamic";

/** 模拟积分加油包购买；档位见 lib/billing/credit-topup-packs.ts */
export async function POST(req: Request) {
  if (!allowDevMockPaymentApis()) {
    return NextResponse.json(
      { error: "模拟充值未启用（开发环境或 ALLOW_MOCK_PAYMENT=true）" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let packId = ALL_CREDIT_TOPUP_PACKS[0].id;
  let target: CreditTopupTarget = "personal";
  let tenantId: string | null = null;

  try {
    const body = await req.json();
    if (typeof body?.packId === "string") packId = body.packId;
    if (body?.target === "team") target = "team";
    if (typeof body?.tenantId === "string" && body.tenantId.trim()) {
      tenantId = body.tenantId.trim();
    }
  } catch {
    /* default pack */
  }

  try {
    const result = await applyMockCreditTopup({
      userId: session.user.id,
      packId,
      target,
      tenantId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "充值失败";
    const status =
      message.includes("无效") ||
      message.includes("团队") ||
      message.includes("管理员") ||
      message.includes("成员")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
