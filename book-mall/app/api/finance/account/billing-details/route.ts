import { NextRequest } from "next/server";

import {
  fetchBillingDetailsForUser,
  type BillingDetailsTab,
} from "@/lib/finance/billing-details-service";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

function parseTab(raw: string | null): BillingDetailsTab {
  return raw === "charge" ? "charge" : "usage";
}

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 个人账单详情（Finance 2.0 · tab=usage|charge）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tab = parseTab(request.nextUrl.searchParams.get("tab"));
  const take = Number(request.nextUrl.searchParams.get("take") ?? 500);

  const data = await fetchBillingDetailsForUser({ userId: user.id, tab, take });
  if (!data) {
    return financeJson(request, { error: "用户不存在" }, { status: 404 });
  }

  return financeJson(request, {
    ...data,
    viewer: { authMode: "session" as const },
  });
}
