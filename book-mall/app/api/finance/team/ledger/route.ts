import { NextRequest } from "next/server";

import { listTenantLedger } from "@/lib/billing/credit-account-service";
import {
  TeamFinanceForbiddenError,
  assertTeamBillingView,
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
  const actorUserId = request.nextUrl.searchParams.get("actorUserId")?.trim() || undefined;
  const take = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 100)));
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get("skip") ?? 0));

  try {
    const access = await resolveTeamFinanceAccess(user.id, tenantId);
    if (!access.hasTeam || !access.selected) {
      return financeJson(request, { rows: [], total: 0 });
    }
    assertTeamBillingView(access.selected.role);

    const { rows, total } = await listTenantLedger({
      tenantId: access.selected.tenantId,
      actorUserId,
      take,
      skip,
    });

    return financeJson(request, {
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      rows,
      total,
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
