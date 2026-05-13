import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import {
  applyMockSubscriptionPayment,
  type MockSubscribePlanSlug,
} from "@/lib/apply-mock-subscription";

export const dynamic = "force-dynamic";

/** 模拟订阅开通（月度 30 天 / 年度 365 天）；详见 doc/process/mock-payment-checkout.md */
export async function POST(req: Request) {
  if (!allowDevMockPaymentApis()) {
    return NextResponse.json(
      { error: "模拟订阅接口未启用（开发环境或 ALLOW_MOCK_PAYMENT=true）" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let planSlug: MockSubscribePlanSlug = "monthly";
  try {
    const body = await req.json();
    if (typeof body?.planSlug === "string") {
      const s = body.planSlug.trim().toLowerCase();
      if (s === "monthly" || s === "yearly") planSlug = s;
    }
  } catch {
    /* empty body */
  }

  try {
    await applyMockSubscriptionPayment(session.user.id, planSlug);
  } catch (e) {
    const message = e instanceof Error ? e.message : "订阅失败";
    const status = message.includes("未找到计划") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
