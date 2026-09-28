import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { importEcomOutfitVideoLooks } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { sourceProjectId?: string; resultIds?: string[]; lockedLookIds?: string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }
  if (!body.sourceProjectId?.trim()) {
    return ecomJson({ error: "缺少 sourceProjectId" }, { status: 400 });
  }

  try {
    const project = await importEcomOutfitVideoLooks(auth.userId, id, {
      sourceProjectId: body.sourceProjectId.trim(),
      resultIds: body.resultIds,
      lockedLookIds: body.lockedLookIds,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "导入参考失败";
    const status =
      message.includes("不存在") || message.includes("没有可导入") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
