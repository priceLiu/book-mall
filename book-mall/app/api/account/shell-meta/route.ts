import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prepareAccountCanvasLaunch } from "@/lib/account-canvas-launch";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { getMembershipToolAccess } from "@/lib/membership-tool-access";
import { getReferralEligibility } from "@/lib/referral/referral-service";

export const dynamic = "force-dynamic";

/** 个人中心壳层 · 侧栏应用启动权限与分享入口（与页面内容解耦）。 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [memberAccess, canvasLaunch, ecomAccess, referralEligibility] =
      await Promise.all([
        getMembershipToolAccess(userId),
        prepareAccountCanvasLaunch(userId),
        userCanAccessEcommerceToolkit(userId),
        getReferralEligibility(userId),
      ]);

    return NextResponse.json({
      hasMembership: memberAccess.ok,
      canvasLaunch,
      ecomAccess,
      referralEligibility,
    });
  } catch (e) {
    console.error("[account/shell-meta]", e);
    return NextResponse.json({ error: "加载失败" }, { status: 500 });
  }
}
