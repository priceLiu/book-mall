import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateFilmPullReplicaModelPrompt } from "@/lib/ecom/ecom-film-pull-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await generateFilmPullReplicaModelPrompt(
      auth.userId,
      id,
      typeof body.modelKey === "string" ? body.modelKey : undefined,
    );
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
