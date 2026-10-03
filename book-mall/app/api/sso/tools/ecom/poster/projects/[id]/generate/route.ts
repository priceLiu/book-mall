import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { runPosterGenerate } from "@/lib/ecom/ecom-poster-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const count =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.round(body.count)
      : undefined;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await runPosterGenerate(auth.userId, params.id, count);
    return ecomJson(result);
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "生成失败" }, { status: 400 });
  }
}
