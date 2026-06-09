import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { allowDevMockPaymentApis } from "@/lib/dev-mock-payment";
import { applyMockByokSubscribe } from "@/lib/billing/apply-mock-byok-subscribe";

export const dynamic = "force-dynamic";

/** 模拟开通/续订 BYOK 套餐（个人或团队） */
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

  let scopeKey = "personal";
  let target: "personal" | "team" = "personal";
  let tenantId: string | null = null;
  let seats: number | undefined;

  try {
    const body = await req.json();
    if (typeof body?.scopeKey === "string") scopeKey = body.scopeKey.trim();
    if (body?.target === "team") target = "team";
    if (typeof body?.tenantId === "string" && body.tenantId.trim()) {
      tenantId = body.tenantId.trim();
    }
    if (typeof body?.seats === "number" && Number.isFinite(body.seats)) {
      seats = body.seats;
    }
  } catch {
    /* defaults */
  }

  try {
    const result = await applyMockByokSubscribe({
      userId: session.user.id,
      scopeKey,
      target,
      tenantId,
      seats,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "开通失败";
    const status =
      message.includes("无效") ||
      message.includes("团队") ||
      message.includes("主账号") ||
      message.includes("未配置")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
