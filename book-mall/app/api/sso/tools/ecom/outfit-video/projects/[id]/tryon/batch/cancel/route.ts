import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { cancelEcomOutfitVideoTryonBatch } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const project = await cancelEcomOutfitVideoTryonBatch(auth.userId, id);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "停止试衣失败";
    const status = message.includes("没有") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
