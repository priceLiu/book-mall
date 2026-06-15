import { NextRequest } from "next/server";

import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { getTenantOverview } from "@/lib/tenant/tenant-service";
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
      return financeJson(request, { hasTeam: false, members: [] });
    }
    assertTeamBillingView(access.selected.role);

    const [overview, bill] = await Promise.all([
      getTenantOverview(access.selected.tenantId),
      buildTeamCreditBill({ tenantId: access.selected.tenantId, periodKey }),
    ]);

    const memberBillMap = new Map(bill.members.map((m) => [m.actorUserId, m]));

    const members = (overview?.members ?? []).map((m) => {
      const usage = memberBillMap.get(m.userId);
      return {
        memberId: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        seatId: m.seatId,
        seatLabel: m.seat?.label ?? null,
        monthlyCapCredits: m.monthlyCapCredits ?? overview?.account?.perSeatCapCredits ?? null,
        consumed: usage?.consumed ?? 0,
        count: usage?.count ?? 0,
      };
    });

    members.sort((a, b) => b.consumed - a.consumed);

    return financeJson(request, {
      hasTeam: true,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      periodKey,
      members,
      perSeatCapCredits: overview?.account?.perSeatCapCredits ?? null,
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
