import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { removeEcomModelTryonGeneration } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; generationId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, generationId } = await ctx.params;

  try {
    const project = await removeEcomModelTryonGeneration(auth.userId, id, generationId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除模特失败";
    const status = message === "项目不存在" || message.includes("未找到") ? 404 : 400;
    return ecomJson({ error: message }, { status });
  }
}
