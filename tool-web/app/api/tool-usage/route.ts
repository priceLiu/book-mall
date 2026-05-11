import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 浏览器异步打点：透传 Cookie 中的工具 JWT 到主站写入 ToolUsageEvent。
 */
export async function POST(req: Request) {
  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const origin = getMainSiteOrigin();
  if (!origin || origin.trim().length === 0) {
    return NextResponse.json({ error: "main_origin_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const base = origin.replace(/\/$/, "");
  const r = await fetch(`${base}/api/sso/tools/usage`, {
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
