import { NextRequest } from "next/server";
import { z } from "zod";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { computeReferralPayoutPreview } from "@/lib/referral/referral-payout-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) });

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：计算某周期返佣（预览，不落库）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "返佣结算数据仅财务管理员可见");
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "请求体无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(request, { error: "周期格式应为 YYYY-MM" }, { status: 400 });
  }
  const result = await computeReferralPayoutPreview(parsed.data.periodKey);
  if ("error" in result) {
    return financeJson(request, { error: result.error }, { status: 400 });
  }
  return financeJson(request, result);
}
