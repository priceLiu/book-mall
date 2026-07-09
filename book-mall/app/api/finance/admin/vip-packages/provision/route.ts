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
import { provisionVipPackage } from "@/lib/finance/vip-package-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ownerUserId: z.string().min(1),
  teamName: z.string().min(1).max(64),
  amountYuan: z.number().positive(),
  targetMargin: z.number().min(0).max(0.99),
  scheme: z.enum(["general_heavy", "video_heavy"]),
  videoFraction: z.number().min(0).max(1),
  seats: z.number().int().min(1).max(1000),
});

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：开通 VIP 大额套餐（创建团队租户 + 发放双池积分）。仅财务管理员。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可开通 VIP 套餐");
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

  const result = await provisionVipPackage({
    ...parsed.data,
    adminUserId: user.id,
  });
  if (!result.ok) {
    return financeJson(request, { error: result.reason }, { status: 400 });
  }
  return financeJson(request, { ...result });
}
