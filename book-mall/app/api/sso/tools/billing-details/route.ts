import { NextResponse } from "next/server";

import {
  fetchBillingDetailsForUser,
  type BillingDetailsTab,
} from "@/lib/finance/billing-details-service";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function parseTab(raw: string | null): BillingDetailsTab {
  return raw === "charge" ? "charge" : "usage";
}

function withBillingPrivacyHeaders(res: NextResponse): NextResponse {
  const h = new Headers(res.headers);
  for (const [key, val] of Object.entries(billingPrivateCacheHeaders("Authorization"))) {
    h.set(key, val);
  }
  return new NextResponse(res.body, { status: res.status, headers: h });
}

/**
 * Finance 2.0 · Gateway 扣减明细（与 finance-web `/api/finance/account/billing-details` 同形）。
 * 供 tool-web 服务端代理；数据源为 GatewayRequestLog + BillingSettlementLine。
 */
export async function GET(req: Request) {
  const v = verifyToolsBearer(req);
  if (!v.ok) return withBillingPrivacyHeaders(v.res);

  const url = new URL(req.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const take = Number(url.searchParams.get("take") ?? 200);

  const data = await fetchBillingDetailsForUser({
    userId: v.userId,
    tab,
    take,
  });
  if (!data) {
    return NextResponse.json(
      { error: "用户不存在" },
      { status: 404, headers: billingPrivateCacheHeaders("Authorization") },
    );
  }

  return NextResponse.json(
    {
      ...data,
      viewer: { authMode: "tools_bearer" as const },
    },
    { headers: billingPrivateCacheHeaders("Authorization") },
  );
}
