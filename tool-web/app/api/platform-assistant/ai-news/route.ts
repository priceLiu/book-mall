import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 平台 AI 小智 · tool-web 热闻代理（只读 DB，无需登录） */
export async function GET() {
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin) {
    return Response.json(
      { error: "工具站未配置 MAIN_SITE_ORIGIN" },
      { status: 503 },
    );
  }

  const token = cookies().get("tools_token")?.value?.trim();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const upstream = await fetch(`${origin}/api/platform-assistant/ai-news`, {
    method: "GET",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
