import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { getVipTenantOpsDetail } from "@/lib/finance/vip-ops-service";

type RouteContext = { params: { tenantId: string } };

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务权限");
  }

  const detail = await getVipTenantOpsDetail(params.tenantId);
  if (!detail) {
    return financeJson(request, { error: "团队不存在" }, { status: 404 });
  }
  return financeJson(request, detail);
}
