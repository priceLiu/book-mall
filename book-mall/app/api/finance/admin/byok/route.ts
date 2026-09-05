import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import { buildByokFinanceReport } from "@/lib/billing/byok-pricing";
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

function currentPeriodKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "BYOK 配置仅财务管理员可见");
  }

  const periodKey = request.nextUrl.searchParams.get("periodKey") ?? currentPeriodKey();
  const report = await buildByokFinanceReport(periodKey);
  return financeJson(request, report);
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) return financeForbidden(request);

  return financeJson(
    request,
    { ok: false, error: "BYOK 产品已退役，配置操作不可用" },
    { status: 410 },
  );
}
