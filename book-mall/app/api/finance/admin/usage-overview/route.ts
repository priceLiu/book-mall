import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { buildUsageOverviewData } from "@/lib/finance/usage-overview-data";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "费用概览仅财务管理员可见");
  }

  const sp = request.nextUrl.searchParams;
  const data = await buildUsageOverviewData({
    since: sp.get("since") ?? undefined,
    tool: sp.get("tool") ?? undefined,
    userId: sp.get("userId") ?? undefined,
    billingPersona: sp.get("billingPersona") ?? undefined,
    staffFlag: sp.get("staffFlag") ?? undefined,
    tenantId: sp.get("tenantId") ?? undefined,
  });
  return financeJson(request, data);
}
