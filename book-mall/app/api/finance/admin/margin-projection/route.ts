import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import { loadMarginProjection } from "@/lib/billing/load-margin-projection";
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

/** 财务管理员：个人/团队档位 × GPT Image 2.0 / Wan 3.0 / HappyHorse 1.1 毛利测算。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "毛利测算仅财务管理员可见");
  }

  try {
    const projection = await loadMarginProjection();
    return financeJson(request, projection);
  } catch (err) {
    console.error("[margin-projection] api failed", err);
    return financeJson(request, { error: "测算失败，请稍后重试" }, { status: 500 });
  }
}
