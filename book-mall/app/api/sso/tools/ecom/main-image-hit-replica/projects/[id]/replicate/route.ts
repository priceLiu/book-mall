import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { replicateMainImageHitBatch } from "@/lib/ecom/main-image-hit-replica/replicate";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await replicateMainImageHitBatch({
      userId: auth.userId,
      projectId: id,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      visionModelKey: typeof body.visionModelKey === "string" ? body.visionModelKey : undefined,
    });
    return ecomJson({
      project: result.project,
      generated: result.generated,
      failures: result.failures,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "复刻失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}