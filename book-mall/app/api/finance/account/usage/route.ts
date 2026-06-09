import { NextRequest } from "next/server";

import {
  aggregateUsageByModel,
  getCreditBalance,
  getPoolBalances,
  listUsageRecords,
} from "@/lib/billing/credit-account-service";
import {
  aggregateUsageByTool,
  countSucceededUsage,
} from "@/lib/finance/account-usage-summary";
import { clientPageToToolLabel } from "@/lib/finance/client-page-tool";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

/** 个人积分用量（财务 2.0 · 个人入口）。 */
export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50)));

  const [balance, pools, byModel, byTool, recent, totalCalls] = await Promise.all([
    getCreditBalance({ ownerType: "USER", ownerId: user.id }),
    getPoolBalances({ ownerType: "USER", ownerId: user.id }),
    aggregateUsageByModel({ bookUserId: user.id }),
    aggregateUsageByTool(user.id),
    listUsageRecords({ bookUserId: user.id, take }),
    countSucceededUsage(user.id),
  ]);

  return financeJson(request, {
    balance,
    pools,
    byModel,
    byTool,
    recent: recent.rows.map((r) => ({
      ...r,
      toolLabel: clientPageToToolLabel(r.clientPage),
    })),
    total: recent.total,
    totalCalls,
    totalConsumed: byModel.reduce((s, m) => s + m.creditsCharged, 0),
  });
}
