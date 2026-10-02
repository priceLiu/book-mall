import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { attachBrandViSketchesFromAssets } from "@/lib/ecom/ecom-brand-vi-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { assetIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.filter((v): v is string => typeof v === "string" && !!v.trim())
    : [];
  if (assetIds.length === 0) {
    return ecomJson({ error: "请至少选择一张资产图" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await attachBrandViSketchesFromAssets(auth.userId, id, assetIds);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "挂载失败";
    const status = message === "项目不存在" ? 404 : 500;
    return ecomJson({ error: message }, { status });
  }
}
