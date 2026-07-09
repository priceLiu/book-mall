import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { listReferralPayouts } from "@/lib/referral/referral-payout-service";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：列出返佣单（?periodKey=YYYY-MM&status=PENDING|PAID|VOID）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "返佣结算数据仅财务管理员可见");
  }
  const url = new URL(request.url);
  const periodKey = url.searchParams.get("periodKey") ?? undefined;
  const statusRaw = url.searchParams.get("status") ?? undefined;
  const status =
    statusRaw === "PENDING" || statusRaw === "PAID" || statusRaw === "VOID"
      ? statusRaw
      : undefined;

  const rows = await listReferralPayouts({
    periodKey: periodKey && /^\d{4}-\d{2}$/.test(periodKey) ? periodKey : undefined,
    status,
  });
  return financeJson(request, {
    payouts: rows.map((r) => ({
      ...r,
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
