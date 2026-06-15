import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/billing-details";

const BILLING_PROXY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Authorization, Cookie",
} as const;

function originOrError(): string | NextResponse {
  const origin = getMainSiteOrigin();
  if (!origin || origin.trim().length === 0) {
    return NextResponse.json(
      { error: "main_origin_not_configured" },
      { status: 503 },
    );
  }
  return origin.replace(/\/$/, "");
}

/** Finance 2.0 · Gateway 扣减明细（与 finance-web 账单详表同源）。 */
export async function GET(request: NextRequest) {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "no_session" },
      { status: 401, headers: BILLING_PROXY_HEADERS },
    );
  }

  const base = originOrError();
  if (base instanceof NextResponse) return base;

  const qs = request.nextUrl.searchParams.toString();
  const url = qs ? `${base}${UPSTREAM}?${qs}` : `${base}${UPSTREAM}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json", ...BILLING_PROXY_HEADERS },
  });
}
