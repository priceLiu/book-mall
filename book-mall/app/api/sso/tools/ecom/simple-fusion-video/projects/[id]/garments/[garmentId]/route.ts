import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { removeSimpleFusionGarment } from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; garmentId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, garmentId } = await ctx.params;
  try {
    const project = await removeSimpleFusionGarment(auth.userId, id, garmentId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("不存在") ? 404 : 400;
    return ecomJson({ error: message }, { status });
  }
}
