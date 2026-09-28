import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { adaptEcomOutfitVideoSceneStoryboard } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; index: string }> };

function parseIndex(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, index: indexRaw } = await ctx.params;
  const sceneIndex = parseIndex(indexRaw);
  if (!sceneIndex) {
    return ecomJson({ error: "无效分镜序号" }, { status: 400 });
  }
  try {
    const project = await adaptEcomOutfitVideoSceneStoryboard(
      auth.userId,
      id,
      sceneIndex,
    );
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "分镜适配失败";
    const status = message.includes("不存在") ? 404 : 400;
    return ecomJson({ error: message }, { status: status === 404 ? 404 : 500 });
  }
}
