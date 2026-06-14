import { NextRequest } from "next/server";

import {
  fetchBillingDetailsForTenant,
  type BillingDetailsTab,
} from "@/lib/finance/billing-details-service";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { getTenant } from "@/lib/tenant/tenant-service";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

type RouteContext = { params: { tenantId: string } };

function parseTab(raw: string | null): BillingDetailsTab {
  return raw === "charge" ? "charge" : "usage";
}

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务/超管权限");
  }

  const actorUserId = request.nextUrl.searchParams.get("actorUserId")?.trim() || undefined;
  const tab = parseTab(request.nextUrl.searchParams.get("tab"));
  const take = Number(request.nextUrl.searchParams.get("take") ?? 500);

  const tenant = await getTenant(params.tenantId);
  if (!tenant || tenant.type !== "TEAM") {
    return financeJson(request, { error: "团队不存在" }, { status: 404 });
  }

  const data = await fetchBillingDetailsForTenant({
    tenantId: params.tenantId,
    actorUserId,
    tab,
    take,
  });
  if (!data) {
    return financeJson(request, { error: "团队不存在" }, { status: 404 });
  }

  return financeJson(request, {
    ...data,
    tenantId: params.tenantId,
    tenantName: tenant.name,
    viewer: { authMode: "session" as const, scope: "admin-team" as const },
  });
}
