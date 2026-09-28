import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { removeFilmPullRef } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; refId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, refId } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await removeFilmPullRef(auth.userId, id, refId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("无效") || message.includes("不存在") ? 400 : 502;
    return ecomJson({ error: message }, { status });
  }
}
