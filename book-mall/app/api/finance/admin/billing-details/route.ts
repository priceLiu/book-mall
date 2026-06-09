import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  fetchBillingDetailsForUser,
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

/** 管理员 · 单用户账单详情（Finance 2.0）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务/超管权限");
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return financeJson(request, { error: "缺少 userId" }, { status: 400 });
  }

  const tab = parseTab(request.nextUrl.searchParams.get("tab"));
  const take = Number(request.nextUrl.searchParams.get("take") ?? 500);

  const data = await fetchBillingDetailsForUser({ userId, tab, take });
  if (!data) {
    return financeJson(request, { error: "用户不存在" }, { status: 404 });
  }

  return financeJson(request, data);
}
