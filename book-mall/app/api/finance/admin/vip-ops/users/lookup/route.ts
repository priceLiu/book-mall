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
import { lookupFinanceUsers } from "@/lib/finance/vip-ops-service";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

const bodySchema = z.object({ query: z.string().min(1).max(120) });

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "需要财务权限");
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

  const users = await lookupFinanceUsers(parsed.data.query);
  return financeJson(request, { users });
}
