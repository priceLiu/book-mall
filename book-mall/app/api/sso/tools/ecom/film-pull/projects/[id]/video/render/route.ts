import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomRenderFilmPullFinalVideo } from "@/lib/ecom/ecom-film-pull-video";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomRenderFilmPullFinalVideo({
      userId: auth.userId,
      projectId: id,
    });
    const project = await getEcomFilmPullProject(auth.userId, id);
    return ecomJson({ ...result, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "合成失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
