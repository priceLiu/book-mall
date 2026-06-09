import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import { buildByokFinanceReport } from "@/lib/billing/byok-pricing";
import { bodyToFormData } from "@/lib/finance/body-to-form-data";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  deleteByokConfigAction,
  saveByokQuotaAction,
  saveResourceRateAction,
  upsertByokConfigAction,
} from "@/app/admin/finance/credit-billing-actions";

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

  const body = (await request.json()) as { action: string } & Record<string, unknown>;
  const fd = bodyToFormData(body);
  let result;
  switch (body.action) {
    case "upsertConfig":
      result = await upsertByokConfigAction(fd);
      break;
    case "deleteConfig":
      result = await deleteByokConfigAction(fd);
      break;
    case "saveRate":
      result = await saveResourceRateAction(fd);
      break;
    case "saveQuota":
      result = await saveByokQuotaAction(fd);
      break;
    default:
      return financeJson(request, { ok: false, error: `未知操作: ${body.action}` }, { status: 400 });
  }
  return financeJson(request, result, { status: result.ok ? 200 : 400 });
}
