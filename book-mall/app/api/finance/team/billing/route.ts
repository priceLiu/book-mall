import { NextRequest } from "next/server";

import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { getTenant } from "@/lib/tenant/tenant-service";
import {
  canViewTeamBilling,
  recentPeriodKeys,
  resolveTeamFinanceAccess,
} from "@/lib/finance/team-finance-guard";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

/** 团队共享积分池账单（财务 2.0 · 团队入口）。仅团队 OWNER/ADMIN 可见明细。 */
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
    periodParam && periods.includes(periodParam) ? periodParam : periods[0];

  const access = await resolveTeamFinanceAccess(user.id, tenantId);

  if (!access.hasTeam || !access.selected) {
    return financeJson(request, { hasTeam: false, teams: [], bill: null, period, periods });
  }

  const canView = canViewTeamBilling(access.selected.role);

  if (!canView) {
    return financeJson(request, {
      hasTeam: true,
      canView: false,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      period,
      periods,
      teams: access.teams,
      bill: null,
    });
  }

  const [tenant, bill] = await Promise.all([
    getTenant(access.selected.tenantId),
    buildTeamCreditBill({ tenantId: access.selected.tenantId, periodKey: period }),
  ]);

  return financeJson(request, {
    hasTeam: true,
    canView: true,
    tenantId: access.selected.tenantId,
    tenantName: tenant?.name ?? access.selected.tenantName,
    period,
    periods,
    teams: access.teams,
    bill,
  });
}
