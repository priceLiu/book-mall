import { NextRequest } from "next/server";

import {
  aggregateUsageByModel,
  listUsageRecords,
} from "@/lib/billing/credit-account-service";
import { canViewTeamBilling, resolveTeamFinanceAccess } from "@/lib/finance/team-finance-guard";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

/** 团队用量：OWNER/ADMIN 可见全员；MEMBER 仅本人。 */
export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const actorUserId = request.nextUrl.searchParams.get("actorUserId")?.trim() || undefined;
  const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50)));

  const access = await resolveTeamFinanceAccess(user.id, tenantId);

  if (!access.hasTeam || !access.selected) {
    return financeJson(request, { hasTeam: false, teams: [], recent: [], byModel: [], total: 0 });
  }

  const teamWide = canViewTeamBilling(access.selected.role);
  const query = {
    bookUserId: teamWide ? actorUserId : user.id,
    tenantId: access.selected.tenantId,
    take,
  };

  const [byModel, recent] = await Promise.all([
    aggregateUsageByModel(query),
    listUsageRecords(query),
  ]);

  return financeJson(request, {
    hasTeam: true,
    canViewAll: teamWide,
    tenantId: access.selected.tenantId,
    tenantName: access.selected.tenantName,
    role: access.selected.role,
    teams: access.teams,
    byModel,
    recent: recent.rows,
    total: recent.total,
    totalConsumed: byModel.reduce((s, m) => s + m.creditsCharged, 0),
  });
}
