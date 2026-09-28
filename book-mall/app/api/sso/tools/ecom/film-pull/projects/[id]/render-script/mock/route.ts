import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  applyMockFilmPullRenderScript,
  isFilmPullMockAllowed,
} from "@/lib/ecom/ecom-film-pull-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Dev only · 跳过 Gateway，写入 mock 渲染脚本 */
export async function POST(_req: Request, ctx: Ctx) {
  if (!isFilmPullMockAllowed()) {
    return ecomJson({ error: "Mock 渲染脚本不可用" }, { status: 403 });
  }

  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    const project = await applyMockFilmPullRenderScript(auth.userId, projectId);
    return ecomJson({ project, mock: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 渲染脚本失败";
    const status = message.includes("不存在") ? 404 : message.includes("请先") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
