import { NextRequest } from "next/server";

import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const periodKey =
    request.nextUrl.searchParams.get("periodKey")?.trim() || currentPeriodKey();

  return financeJson(request, {
    periodKey,
    bill: null,
    usage: [],
    taskUsage: [],
    subscription: null,
    message: "BYOK 产品已退役，请使用会员订阅与 Gateway 平台代付",
  });
}
