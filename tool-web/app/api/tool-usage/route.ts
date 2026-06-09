import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/usage";

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

/** 拉取当前登录用户在主站的历史工具使用明细（Bearer tools_token）。 */
export async function GET(req: Request) {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session", events: [] }, { status: 401 });
  }

  const base = originOrError();
  if (base instanceof NextResponse) return base;

  const q = new URL(req.url).searchParams.toString();
  const path = q.length > 0 ? `${UPSTREAM}?${q}` : UPSTREAM;

  const r = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 旧钱包按次扣点已退役；扣费见 Gateway 结算。 */
export async function POST() {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  return NextResponse.json({ ok: true, recorded: false, creditBilling: true });
}
