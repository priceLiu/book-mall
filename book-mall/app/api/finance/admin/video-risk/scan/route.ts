import { NextRequest } from "next/server";

import { scanAbnormalUsers } from "@/lib/billing/video-abnormal-scan";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) return financeForbidden(request);

  const users = await scanAbnormalUsers();
  return financeJson(request, { ok: true, count: users.length, users });
}
