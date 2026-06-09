import { NextRequest } from "next/server";

import {
  aggregateUsageByModel,
  listUsageRecords,
} from "@/lib/billing/credit-account-service";
import { listUserTenantMemberships } from "@/lib/tenant/context";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

/** 团队成员只读「我的用量」（团队上下文下按 actorBookUserId + tenantId 过滤）。 */
export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50)));

  const memberships = await listUserTenantMemberships(user.id);
  const teams = memberships.filter((m) => m.tenantType === "TEAM");

  if (teams.length === 0) {
    return financeJson(request, { hasTeam: false, teams: [], recent: [], byModel: [], total: 0 });
  }

  const selected =
    teams.find((t) => t.tenantId === tenantId) ?? teams[0];

  const query = {
    bookUserId: user.id,
    tenantId: selected.tenantId,
    take,
  };

  const [byModel, recent] = await Promise.all([
    aggregateUsageByModel(query),
    listUsageRecords(query),
  ]);

  return financeJson(request, {
    hasTeam: true,
    tenantId: selected.tenantId,
    tenantName: selected.tenantName,
    role: selected.role,
    teams: teams.map((t) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      role: t.role,
    })),
    byModel,
    recent: recent.rows,
    total: recent.total,
    totalConsumed: byModel.reduce((s, m) => s + m.creditsCharged, 0),
  });
}
