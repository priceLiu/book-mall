import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/introspect";

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

/** 透传工具 JWT 查询主站 introspect，返回钱包余额与最低线（分）。 */
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

  const raw = (await r.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!r.ok || raw == null) {
    return NextResponse.json(
      {
        error: typeof raw?.error === "string" ? raw.error : "upstream",
        active: false,
      },
      { status: r.status >= 400 ? r.status : 502 },
    );
  }

  const active = raw.active === true;
  const balancePoints =
    typeof raw.balance_points === "number" && Number.isFinite(raw.balance_points)
      ? Math.max(0, Math.floor(raw.balance_points))
      : null;
  const minBalanceLinePoints =
    typeof raw.min_balance_line_points === "number" &&
    Number.isFinite(raw.min_balance_line_points)
      ? Math.max(0, Math.floor(raw.min_balance_line_points))
      : null;

  return NextResponse.json({
    active,
    balancePoints,
    minBalanceLinePoints,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
  });
}
