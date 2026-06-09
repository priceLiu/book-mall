import { NextRequest } from "next/server";

import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { getTenant } from "@/lib/tenant/tenant-service";
import { listUserTenantMemberships } from "@/lib/tenant/context";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

function recentPeriodKeys(count = 6): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

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

  const memberships = await listUserTenantMemberships(user.id);
  const teams = memberships.filter((m) => m.tenantType === "TEAM");

  if (teams.length === 0) {
    return financeJson(request, { hasTeam: false, teams: [], bill: null, period, periods });
  }

  const selected =
    teams.find((t) => t.tenantId === tenantId) ?? teams[0];
  const canView = selected.role === "OWNER" || selected.role === "ADMIN";

  if (!canView) {
    return financeJson(request, {
      hasTeam: true,
      canView: false,
      tenantId: selected.tenantId,
      tenantName: selected.tenantName,
      period,
      periods,
      teams: teams.map((t) => ({
        tenantId: t.tenantId,
        tenantName: t.tenantName,
        role: t.role,
        canViewBilling: t.role === "OWNER" || t.role === "ADMIN",
      })),
      bill: null,
    });
  }

  const [tenant, bill] = await Promise.all([
    getTenant(selected.tenantId),
    buildTeamCreditBill({ tenantId: selected.tenantId, periodKey: period }),
  ]);

  return financeJson(request, {
    hasTeam: true,
    canView: true,
    tenantId: selected.tenantId,
    tenantName: tenant?.name ?? selected.tenantName,
    period,
    periods,
    teams: teams.map((t) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      role: t.role,
      canViewBilling: t.role === "OWNER" || t.role === "ADMIN",
    })),
    bill,
  });
}
