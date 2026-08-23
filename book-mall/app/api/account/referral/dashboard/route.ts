import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { serializeReferralDashboard } from "@/lib/account/referral-dashboard-json";
import {
  ensureReferralProfile,
  getReferralDashboard,
  getReferralEligibility,
} from "@/lib/referral/referral-service";
import { resolveBookMallOrigin } from "@/lib/platform-traffic/book-mall-origin";

export const dynamic = "force-dynamic";

function resolveShareBaseUrl(request: NextRequest): string {
  const fromEnv = resolveBookMallOrigin();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return request.nextUrl.origin.replace(/\/$/, "");
}

/** 分享弹层 / 明细页 · 邀请码与统计（eligible=false 仍 200，便于客户端展示原因）。 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const eligibility = await getReferralEligibility(session.user.id);
  if (!eligibility.eligible) {
    return NextResponse.json({
      ok: true,
      eligible: false,
      reason: eligibility.reason ?? "不满足分享门禁",
    });
  }

  const ensured = await ensureReferralProfile(session.user.id);
  if (!ensured.ok) {
    return NextResponse.json({
      ok: false,
      eligible: false,
      reason: ensured.reason,
    });
  }

  const dashboard = await getReferralDashboard(
    session.user.id,
    resolveShareBaseUrl(request),
  );
  if (!dashboard) {
    return NextResponse.json({ error: "加载分享数据失败" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    eligible: true,
    dashboard: serializeReferralDashboard(dashboard, eligibility.planLabel),
  });
}
