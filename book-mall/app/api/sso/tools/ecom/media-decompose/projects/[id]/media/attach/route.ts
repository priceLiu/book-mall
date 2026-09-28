import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { attachMediaDecomposeFromAsset } from "@/lib/ecom/ecom-media-decompose-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { assetId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  if (!assetId) {
    return ecomJson({ error: "缺少 assetId" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await attachMediaDecomposeFromAsset(auth.userId, id, assetId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "挂载失败";
    const status = message === "项目不存在" || message.includes("资产") ? 404 : 500;
    return ecomJson({ error: message }, { status });
  }
}
