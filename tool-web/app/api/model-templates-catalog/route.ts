import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireActiveToolsSession } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

const UPSTREAM = "/api/sso/tools/gateway/model-templates/catalog";

/** 场景模板静态目录代理（供 image-to-video lab 等选模过滤） */
export async function GET() {
  const gate = await requireActiveToolsSession();
  if (!gate.ok) return gate.response;

  const jar = cookies();
  const token = jar.get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin) {
    return NextResponse.json({ error: "main_origin_not_configured" }, { status: 503 });
  }

  const r = await fetch(`${origin}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, {
    status: r.status,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
