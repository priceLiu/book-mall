import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  loadAccountOverview,
  serializeAccountOverview,
} from "@/lib/account/load-account-overview";
import { getReferralEligibility } from "@/lib/referral/referral-service";

export const dynamic = "force-dynamic";

/** 个人中心概览 · 单次聚合（积分/套餐/本月用量）。 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const [overview, referralEligibility] = await Promise.all([
      loadAccountOverview(session.user.id),
      getReferralEligibility(session.user.id),
    ]);
    return NextResponse.json({
      ...serializeAccountOverview(overview),
      referralEligibility,
    });
  } catch (e) {
    console.error("[account/overview]", e);
    return NextResponse.json({ error: "加载失败" }, { status: 500 });
  }
}
