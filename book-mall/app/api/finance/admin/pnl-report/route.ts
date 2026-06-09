import { NextRequest } from "next/server";

import { buildPnlReport } from "@/lib/billing/pnl-report";
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
  if (!canViewFinanceCost(user.role)) return financeForbidden(request);

  const periodKey =
    new URL(request.url).searchParams.get("periodKey")?.trim() ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const report = await buildPnlReport(periodKey);
  return financeJson(request, { ok: true, report });
}
