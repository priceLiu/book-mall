import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  confirmEcomModelTryonGeneration,
  unconfirmEcomModelTryonGeneration,
} from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; generationId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, generationId } = await ctx.params;

  try {
    const project = await confirmEcomModelTryonGeneration(auth.userId, id, generationId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "确认试衣模特失败";
    const status = message === "项目不存在" || message.includes("未找到") ? 404 : 400;
    return ecomJson({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, generationId } = await ctx.params;

  try {
    const project = await unconfirmEcomModelTryonGeneration(auth.userId, id, generationId);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "移出待试衣失败";
    const status = message === "项目不存在" || message.includes("未找到") ? 404 : 400;
    return ecomJson({ error: message }, { status });
  }
}
