import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { applyFilmPullProductionAssemble } from "@/lib/ecom/ecom-film-pull-production-assemble";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const productionPlan = await applyFilmPullProductionAssemble(auth.userId, id);
    const project = await getEcomFilmPullProject(auth.userId, id);
    return ecomJson({ productionPlan, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "组装失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
