import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  fetchBillingDetailsAllUsers,
  type BillingDetailsTab,
} from "@/lib/finance/billing-details-service";
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

/** 管理员 · 全部用户账单明细（Finance 2.0）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务/超管权限");
  }

  const tab = parseTab(request.nextUrl.searchParams.get("tab"));
  const take = Number(request.nextUrl.searchParams.get("take") ?? 2000);

  const data = await fetchBillingDetailsAllUsers({ tab, take });
  return financeJson(request, data);
}
