import { NextResponse } from "next/server";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

/**
 * 校验短时 JWT；工具站在敏感操作前可调用以复核黄金会员状态（服务端携带 Bearer）。
 */
export async function GET(req: Request) {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 });
  }

  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return NextResponse.json({ active: false }, { status: 401 });
  }

  const gold = await getGoldMemberAccess(verified.sub);
  if (!gold.isGoldMember) {
    return NextResponse.json({
      active: false,
      reason: "gold_membership_lost",
      sub: verified.sub,
    });
  }

  return NextResponse.json({
    active: true,
    sub: verified.sub,
    tier: verified.tier,
    exp: verified.exp,
    balance_minor: gold.balanceMinor,
    min_balance_line_minor: gold.minBalanceLineMinor,
    has_recharge_history: gold.hasRechargeHistory,
  });
}
