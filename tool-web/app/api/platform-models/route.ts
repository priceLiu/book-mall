import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/platform/models";

function originOrError(): string | NextResponse {
  const origin = getMainSiteOrigin();
  if (!origin || origin.trim().length === 0) {
    return NextResponse.json({ error: "main_origin_not_configured" }, { status: 503 });
  }
  return origin.replace(/\/$/, "");
}

/** 平台代付用户可见的视频模型 offering（去厂商、去重） */
export async function GET(request: Request) {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const base = originOrError();
  if (base instanceof NextResponse) return base;

  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const upstream = `${base}${UPSTREAM}${qs ? `?${qs}` : "?app=tool&role=VIDEO"}`;

  const r = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
