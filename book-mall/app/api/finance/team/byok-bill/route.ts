import { NextRequest } from "next/server";

import {
  TeamFinanceForbiddenError,
  assertTeamBillingView,
  currentPeriodKey,
  resolveTeamFinanceAccess,
} from "@/lib/finance/team-finance-guard";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const periodKey =
    request.nextUrl.searchParams.get("periodKey")?.trim() || currentPeriodKey();

  try {
    const access = await resolveTeamFinanceAccess(user.id, tenantId);
    if (!access.hasTeam || !access.selected) {
      return financeJson(request, { periodKey, bill: null, message: "未加入团队" });
    }
    assertTeamBillingView(access.selected.role);

    return financeJson(request, {
      periodKey,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      bill: null,
      usage: [],
      taskUsage: [],
      memberBreakdown: [],
      subscription: null,
      message: "BYOK 产品已退役，请使用会员订阅与 Gateway 平台代付",
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
