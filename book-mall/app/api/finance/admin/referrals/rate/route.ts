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
import { setReferralCommissionRate } from "@/lib/referral/referral-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  referrerUserId: z.string().min(1),
  /// 返佣比例：0~1 的小数（如 0.1 = 10%）
  rate: z.number().min(0).max(1),
  note: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：财务管理员录入某分享人的返佣比例（可同时停用/启用、加备注）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可设置返佣比例");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return financeJson(request, { error: "请求体无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return financeJson(
      request,
      { error: "参数无效", detail: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await setReferralCommissionRate({
    referrerUserId: parsed.data.referrerUserId,
    rate: parsed.data.rate,
    adminUserId: user.id,
    note: parsed.data.note ?? undefined,
    enabled: parsed.data.enabled,
  });
  if (!result.ok) {
    return financeJson(request, { error: result.reason }, { status: 400 });
  }
  return financeJson(request, { ok: true });
}
