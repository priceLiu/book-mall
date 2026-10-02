import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { planAndPromptsAiDetailPage } from "@/lib/ecom/detail-page-aplus/aplus-plan-and-prompts";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { modelKey?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await planAndPromptsAiDetailPage({
      userId: auth.userId,
      projectId: id,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "生成失败" },
      { status: 400 },
    );
  }
}
