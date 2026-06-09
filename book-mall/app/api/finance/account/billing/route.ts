import { NextRequest } from "next/server";

import { buildUserCreditBill } from "@/lib/billing/credit-reconciliation";
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

  const bill = await buildUserCreditBill({
    ref: { ownerType: "USER", ownerId: user.id },
    periodKey,
  });

  return financeJson(request, { periodKey, bill });
}
