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
import { computeVipPackageQuote } from "@/lib/finance/vip-package-calculator";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountYuan: z.number().positive(),
  targetMargin: z.number().min(0).max(0.99).optional(),
  generalHeavyVideoFraction: z.number().min(0).max(1).optional(),
  videoHeavyVideoFraction: z.number().min(0).max(1).optional(),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：VIP 大额套餐测算（双方案，管理员/财务可见）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "VIP 测算仅财务管理员可用");
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

  const quote = computeVipPackageQuote(parsed.data);
  return financeJson(request, { quote });
}
