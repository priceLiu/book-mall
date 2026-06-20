import { fetchGatewayModelsFromBook } from "@/lib/forward-gateway-models-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gw = await fetchGatewayModelsFromBook();
  if (!gw.ok) {
    const message =
      gw.reason === "no_session"
        ? "请先登录"
        : gw.reason === "no_origin"
          ? "未配置 MAIN_SITE_ORIGIN"
          : gw.message ?? "Gateway 模型列表获取失败";
    const status =
      gw.reason === "no_session"
        ? 401
        : gw.reason === "no_origin"
          ? 503
          : gw.status && gw.status >= 400 && gw.status < 600
            ? gw.status
            : 502;
    return Response.json({ error: message }, { status });
  }
  return Response.json(gw.data);
}
