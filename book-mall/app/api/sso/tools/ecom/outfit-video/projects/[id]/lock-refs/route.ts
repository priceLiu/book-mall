import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { lockEcomOutfitVideoRefs } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const project = await lockEcomOutfitVideoRefs(auth.userId, id);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "锁定参考失败";
    const status = message.includes("请先") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
