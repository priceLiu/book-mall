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

/** 拉取当前登录用户在主站的工具使用明细（Bearer tools_token）。 */
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

/**
 * 代理主站写入 `ToolUsageEvent`：主站根据 `meta.modelId / apiModel / ...` 自身从 `ToolBillablePrice` 解析
 * 单价；只有解析出正金额时才会入库，否则返回 `{ recorded: false }`。客户端不再发 `costPoints` 字段。
 */
export async function POST(req: Request) {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const base = originOrError();
  if (base instanceof NextResponse) return base;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const r = await fetch(`${base}${UPSTREAM}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const payload = (await r.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return NextResponse.json(payload ?? { error: "upstream" }, { status: r.status });
}
