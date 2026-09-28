import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { isFilmPullMockAllowed } from "@/lib/ecom/ecom-film-pull-mock";
import { applyFilmPullRefMatchAuto } from "@/lib/ecom/ecom-film-pull-ref-match";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  if (!isFilmPullMockAllowed()) {
    return ecomJson({ error: "Mock 未启用" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const refMatch = await applyFilmPullRefMatchAuto(auth.userId, id);
    const project = await getEcomFilmPullProject(auth.userId, id);
    return ecomJson({ refMatch, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 匹配失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
