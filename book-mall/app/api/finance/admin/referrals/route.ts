import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { listReferralAdminOverview } from "@/lib/referral/referral-service";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web 分享返佣概览：全部分享人 + 下线消费汇总 + 返佣比例 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "分享返佣数据仅财务管理员可见");
  }

  const rows = await listReferralAdminOverview();
  return financeJson(request, {
    referrals: rows.map((r) => ({
      ...r,
      rateUpdatedAt: r.rateUpdatedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
