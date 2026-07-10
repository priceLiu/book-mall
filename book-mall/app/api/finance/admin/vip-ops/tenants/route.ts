import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { listVipTeams } from "@/lib/finance/vip-ops-service";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务权限");
  }

  const take = Number(request.nextUrl.searchParams.get("take") ?? 50);
  const teams = await listVipTeams(take);
  return financeJson(request, { teams });
}
