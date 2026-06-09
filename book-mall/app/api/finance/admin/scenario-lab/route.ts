import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { buildScenarioLabRows, scenarioLabMeta, validateScenarioLabRows } from "@/lib/billing/scenario-lab";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 财务 2.0 scenario-lab：30 个视频模型在个人/团队档位下的扣费与毛利验算。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "scenario-lab 仅财务管理员可见");
  }

  const rows = buildScenarioLabRows();
  const validation = validateScenarioLabRows(rows);
  const onlyValidation = request.nextUrl.searchParams.get("validateOnly") === "1";

  return financeJson(request, {
    meta: scenarioLabMeta(),
    validation,
    rows: onlyValidation ? [] : rows,
  });
}
