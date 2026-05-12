import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
 * 浏览器异步打点：透传 Cookie 中的工具 JWT 到主站写入 ToolUsageEvent。
 */
export async function POST(req: Request) {
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
