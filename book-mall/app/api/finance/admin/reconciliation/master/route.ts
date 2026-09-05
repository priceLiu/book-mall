import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { queryReconciliationMasterTable } from "@/lib/finance/reconciliation-v2/master-table";
import type { ReconStatus } from "@/lib/finance/reconciliation-v2/types";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 对账总表：跨厂商、跨批次合并后的全部明细。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "对账总表仅财务管理员可见");
  }

  const month = request.nextUrl.searchParams.get("month")?.trim() || undefined;
  const periodFrom = request.nextUrl.searchParams.get("periodFrom")?.trim() || undefined;
  const periodTo = request.nextUrl.searchParams.get("periodTo")?.trim() || undefined;
  const periodKey = request.nextUrl.searchParams.get("periodKey")?.trim() || undefined;
  const importVendor = request.nextUrl.searchParams.get("vendor")?.trim() || undefined;
  const status = request.nextUrl.searchParams.get("status")?.trim() as ReconStatus | undefined;
  const take = Number(request.nextUrl.searchParams.get("take") ?? 200);
  const skip = Number(request.nextUrl.searchParams.get("skip") ?? 0);

  const result = await queryReconciliationMasterTable({
    month,
    periodKey,
    period:
      periodFrom && periodTo ? { from: periodFrom, to: periodTo } : undefined,
    importVendor,
    status,
    take,
    skip,
  });

  return financeJson(request, result);
}
