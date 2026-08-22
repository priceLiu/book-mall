import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { refreshPlatformMasterBaseline } from "@/lib/finance/reconciliation-v2/master-table";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 从 Gateway 刷新平台底表（总表已知明细）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "刷新平台底表仅财务管理员可用");
  }

  let body: {
    periodFrom?: string;
    periodTo?: string;
    /** @deprecated */
    months?: string[];
    month?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return financeJson(request, { error: "请提供 JSON body" }, { status: 400 });
  }

  try {
    if (!body.periodFrom?.trim() || !body.periodTo?.trim()) {
      return financeJson(
        request,
        { error: "请提供 periodFrom 与 periodTo（YYYY-MM-DD）" },
        { status: 400 },
      );
    }
    const period = normalizePeriod({
      from: body.periodFrom.trim(),
      to: body.periodTo.trim(),
    });
    const result = await refreshPlatformMasterBaseline({ period });
    return financeJson(request, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return financeJson(request, { error: msg }, { status: 400 });
  }
}
