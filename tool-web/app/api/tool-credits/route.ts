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

/** Finance 2.0 · 统一积分余额（通用池 + 视频池）。 */
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
  const creditBalance =
    typeof raw.credit_balance === "number" && Number.isFinite(raw.credit_balance)
      ? Math.max(0, Math.floor(raw.credit_balance))
      : null;
  const creditPoolsRaw = raw.credit_pools;
  const creditPools =
    creditPoolsRaw &&
    typeof creditPoolsRaw === "object" &&
    typeof (creditPoolsRaw as { general?: unknown }).general === "number" &&
    typeof (creditPoolsRaw as { video?: unknown }).video === "number"
      ? {
          general: Math.max(
            0,
            Math.floor((creditPoolsRaw as { general: number }).general),
          ),
          video: Math.max(
            0,
            Math.floor((creditPoolsRaw as { video: number }).video),
          ),
        }
      : null;

  return NextResponse.json({
    active,
    creditBalance,
    creditPools,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
  });
}
