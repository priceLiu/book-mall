import { NextRequest } from "next/server";

import { getPnlAlerts } from "@/lib/billing/pnl-alerts";
import { canViewFinanceCost } from "@/lib/auth/permissions";
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
  if (!canViewFinanceCost(user.role)) return financeForbidden(request, "需要财务/超管权限");

  const periodKey =
    request.nextUrl.searchParams.get("period") ??
    (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    })();

  const data = await getPnlAlerts(periodKey);
  return financeJson(request, { periodKey, ...data });
}
