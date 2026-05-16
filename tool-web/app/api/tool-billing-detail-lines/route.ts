import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/billing-detail-lines";

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

/** 当前会话用户在主站的云级账单明细（与 finance-web 表格同源：ToolBillingDetailLine）。 */
export async function GET() {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const base = originOrError();
  if (base instanceof NextResponse) return base;

  const r = await fetch(`${base}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
