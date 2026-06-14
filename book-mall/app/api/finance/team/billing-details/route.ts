import { NextRequest } from "next/server";

import {
  fetchBillingDetailsForTenant,
  type BillingDetailsTab,
} from "@/lib/finance/billing-details-service";
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

function parseTab(raw: string | null): BillingDetailsTab {
  return raw === "charge" ? "charge" : "usage";
}

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const actorUserId = request.nextUrl.searchParams.get("actorUserId")?.trim() || undefined;
  const tab = parseTab(request.nextUrl.searchParams.get("tab"));
  const take = Number(request.nextUrl.searchParams.get("take") ?? 500);

  try {
    const access = await resolveTeamFinanceAccess(user.id, tenantId);
    if (!access.hasTeam || !access.selected) {
      return financeJson(request, { error: "未加入团队" }, { status: 404 });
    }
    assertTeamBillingView(access.selected.role);

    const data = await fetchBillingDetailsForTenant({
      tenantId: access.selected.tenantId,
      actorUserId,
      tab,
      take,
    });
    if (!data) {
      return financeJson(request, { error: "团队不存在" }, { status: 404 });
    }

    return financeJson(request, {
      ...data,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      viewer: { authMode: "session" as const, scope: "team" as const },
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
