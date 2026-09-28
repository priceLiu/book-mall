import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { runEcomModelTryonBatch } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const project = await runEcomModelTryonBatch(auth.userId, id);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 试衣失败";
    const status =
      message.includes("请先") ||
      message.includes("已穿搭")
        ? 400
        : 500;
    return ecomJson({ error: message }, { status });
  }
}
