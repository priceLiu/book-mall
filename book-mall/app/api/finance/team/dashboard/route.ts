import { NextRequest } from "next/server";

import { buildTeamDashboard } from "@/lib/billing/credit-reconciliation";
import {
  TeamFinanceForbiddenError,
  assertTeamBillingView,
  currentPeriodKey,
  recentPeriodKeys,
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
  const periods = recentPeriodKeys(6);
  const periodParam = request.nextUrl.searchParams.get("period");
  const period =
    periodParam && periods.includes(periodParam) ? periodParam : periods[0] ?? currentPeriodKey();

  try {
    const access = await resolveTeamFinanceAccess(user.id, tenantId);
    if (!access.hasTeam || !access.selected) {
      return financeJson(request, { hasTeam: false, teams: [], dashboard: null, period, periods });
    }

    assertTeamBillingView(access.selected.role);

    const dashboard = await buildTeamDashboard({
      tenantId: access.selected.tenantId,
      periodKey: period,
    });

    return financeJson(request, {
      hasTeam: true,
      canView: true,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      role: access.selected.role,
      period,
      periods,
      teams: access.teams,
      dashboard,
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
