import { NextRequest } from "next/server";
import { z } from "zod";

import { canManagePricing } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { updateReferralPayoutStatus } from "@/lib/referral/referral-payout-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "PAID", "VOID"]),
  note: z.string().max(500).optional(),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：标记返佣单状态（打款/作废，仅财务管理员）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可更新返佣单状态");
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "请求体无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(request, { error: "参数无效" }, { status: 400 });
  }
  const result = await updateReferralPayoutStatus({
    id: parsed.data.id,
    status: parsed.data.status,
    adminUserId: user.id,
    note: parsed.data.note,
  });
  if (!result.ok) {
    return financeJson(request, { error: result.reason }, { status: 400 });
  }
  return financeJson(request, { ok: true });
}
