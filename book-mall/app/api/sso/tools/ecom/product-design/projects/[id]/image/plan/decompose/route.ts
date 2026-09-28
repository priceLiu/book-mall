import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { decomposeImageGenPlan } from "@/lib/ecom/ecom-product-design-image-plan";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const intentPrompt = typeof body.intentPrompt === "string" ? body.intentPrompt : undefined;
  const source =
    body.source === "reference-intent"
      ? "reference-intent"
      : body.source === "reference-decompose"
        ? "reference-decompose"
        : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await decomposeImageGenPlan({
      userId: auth.userId,
      projectId: id,
      target,
      modelKey,
      intentPrompt,
      source,
    });
    return ecomJson({ plan: result.plan, project: result.project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "拆解失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}
