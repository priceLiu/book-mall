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

export const dynamic = "force-dynamic";

const bodySchema = z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/) });

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web：生成/刷新某周期返佣单（仅财务管理员）。 */
export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可生成返佣单");
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
  return financeJson(
    request,
    {
      error:
        "现金返佣已退役（分享规则 2.0）。新奖励为积分自动发放，历史返佣单仅只读。",
      deprecated: true,
    },
    { status: 410 },
  );
}
