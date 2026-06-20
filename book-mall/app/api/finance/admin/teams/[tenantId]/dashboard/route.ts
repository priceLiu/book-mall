import { NextRequest } from "next/server";

import { buildTeamDashboard } from "@/lib/billing/credit-reconciliation";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  currentPeriodKey,
  recentPeriodKeys,
} from "@/lib/finance/team-finance-guard";
import { resolveTenantPackageSnapshot } from "@/lib/finance/tenant-package-snapshot";
import { getTenant } from "@/lib/tenant/tenant-service";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

type RouteContext = { params: { tenantId: string } };

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务/超管权限");
  }

  const periods = recentPeriodKeys(6);
  const periodParam = request.nextUrl.searchParams.get("period");
  const period =
    periodParam && periods.includes(periodParam) ? periodParam : periods[0] ?? currentPeriodKey();

  const tenant = await getTenant(params.tenantId);
  if (!tenant || tenant.type !== "TEAM") {
    return financeJson(request, { error: "团队不存在" }, { status: 404 });
  }

  const dashboard = await buildTeamDashboard({
    tenantId: params.tenantId,
    periodKey: period,
    includeCost: true,
  });

  const packageSnapshot = await resolveTenantPackageSnapshot({
    id: tenant.id,
    planId: tenant.planId,
    seatLimit: tenant.seatLimit,
    interval: tenant.interval,
    currentPeriodEnd: tenant.currentPeriodEnd,
    createdAt: tenant.createdAt,
  });

  return financeJson(request, {
    tenantId: params.tenantId,
    tenantName: tenant.name,
    period,
    periods,
    packageSnapshot,
    dashboard,
  });
}
