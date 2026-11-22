import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { appendImageGenPlanItem } from "@/lib/ecom/ecom-product-design-image-plan";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const target = body.target === "detail" ? "detail" : "main";
  const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await appendImageGenPlanItem({
      userId: auth.userId,
      projectId: id,
      target,
      modelKey,
    });
    return ecomJson({
      plan: result.plan,
      project: result.project,
      newIndex: result.newIndex,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "追加槽位失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}