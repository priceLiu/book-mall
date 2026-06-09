import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import { applyMockMembershipSubscribe } from "@/lib/billing/apply-mock-membership-subscribe";
import { BillingPersonaError } from "@/lib/billing/billing-persona";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!allowDevMockPaymentApis()) {
    return NextResponse.json(
      { error: "模拟支付未启用（开发环境或 ALLOW_MOCK_PAYMENT=true）" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let planId = "";
  let seats: number | undefined;
  let teamName: string | null = null;

  try {
    const body = await req.json();
    if (typeof body?.planId === "string") planId = body.planId.trim();
    if (typeof body?.seats === "number" && Number.isFinite(body.seats)) seats = body.seats;
    if (typeof body?.teamName === "string") teamName = body.teamName.trim() || null;
  } catch {
    /* defaults */
  }

  if (!planId) {
    return NextResponse.json({ error: "缺少 planId" }, { status: 400 });
  }

  try {
    const result = await applyMockMembershipSubscribe({
      userId: session.user.id,
      planId,
      seats,
      teamName,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BillingPersonaError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "开通失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
