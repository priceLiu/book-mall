import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 平台 AI 导览助手 · tool-web 代理。
 * tool-web 无通用 book-mall BFF，故单独转发到主站 /api/platform-assistant/chat 并透传 SSE。
 */
export async function POST(req: Request) {
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin) {
    return Response.json(
      { error: "工具站未配置 MAIN_SITE_ORIGIN" },
      { status: 503 },
    );
  }

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return Response.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const body = await req.text();
  const upstream = await fetch(`${origin}/api/platform-assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  if (contentType.includes("text/event-stream") && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
