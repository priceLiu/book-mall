import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { auditS2vReconciliationGap } from "@/lib/finance/reconciliation-v2/s2v-gap-audit";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "S2V 缺口排查仅财务管理员可见");
  }

  const sp = request.nextUrl.searchParams;
  const periodFrom = sp.get("periodFrom")?.trim();
  const periodTo = sp.get("periodTo")?.trim();
  if (!periodFrom || !periodTo) {
    return financeJson(request, { error: "periodFrom 与 periodTo 必填" }, { status: 400 });
  }

  try {
    const period = normalizePeriod({ from: periodFrom, to: periodTo });
    const report = await auditS2vReconciliationGap({
      period,
      take: Number(sp.get("take") ?? "50"),
    });
    return financeJson(request, report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return financeJson(request, { error: msg }, { status: 500 });
  }
}
