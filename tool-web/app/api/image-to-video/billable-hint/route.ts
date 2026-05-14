import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 转发主站 SSO 单价查询，供实验室按钮展示与数据库一致。 */
export async function GET() {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) {
    return NextResponse.json(
      { error: "工具站未配置 MAIN_SITE_ORIGIN" },
      { status: 503 },
    );
  }

  const qs = new URLSearchParams({
    toolKey: "image-to-video",
    action: "invoke",
  });
  const r = await fetch(`${origin}/api/sso/tools/billable-price?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const msg = typeof data.error === "string" ? data.error : `主站返回 HTTP ${r.status}`;
    return NextResponse.json({ error: msg }, { status: r.status >= 400 ? r.status : 502 });
  }

  const pricePoints = data.pricePoints;
  const yuan = data.yuan;
  if (typeof pricePoints !== "number" || typeof yuan !== "number") {
    return NextResponse.json({ error: "主站响应格式异常" }, { status: 502 });
  }

  return NextResponse.json({ pricePoints, yuan });
}
