import { chatStreamFromGateway } from "@/lib/forward-gateway-chat-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.clientPage !== "string" || !body.clientPage.trim()) {
    body.clientPage = "prompt-optimizer";
  }

  const gw = await chatStreamFromGateway(body);

  if (!gw.ok) {
    const message =
      gw.reason === "no_session"
        ? "请先登录"
        : gw.reason === "no_origin"
          ? "未配置 MAIN_SITE_ORIGIN"
          : gw.message ?? gw.error ?? "Gateway 调用失败";
    const code = gw.code ?? "";
    const isKeyRequired = code === "GATEWAY_KEY_REQUIRED";
    const status =
      gw.reason === "no_session"
        ? 401
        : gw.reason === "no_origin"
          ? 503
          : isKeyRequired
            ? 403
            : gw.status && gw.status >= 400 && gw.status < 600
              ? gw.status
              : 502;
    return Response.json(
      {
        error: isKeyRequired ? "gateway_key_required" : "gateway_error",
        message,
        code: code || undefined,
      },
      { status },
    );
  }

  const upstream = gw.response;
  const headers = new Headers();
  const ct =
    upstream.headers.get("content-type") ??
    "text/event-stream; charset=utf-8";
  headers.set("Content-Type", ct);
  headers.set("Cache-Control", "no-store");
  headers.set("Connection", "keep-alive");
  const logId = upstream.headers.get("x-gateway-log-id");
  if (logId) headers.set("X-Gateway-Log-Id", logId);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
