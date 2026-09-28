import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  applyMockFilmPullBatchGenerate,
  isFilmPullMockAllowed,
} from "@/lib/ecom/ecom-film-pull-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Dev only · 跳过 Gateway，用源视频 URL 填充逐镜 videoUrl */
export async function POST(_req: Request, ctx: Ctx) {
  if (!isFilmPullMockAllowed()) {
    return ecomJson({ error: "Mock 批量出镜不可用" }, { status: 403 });
  }

  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    const project = await applyMockFilmPullBatchGenerate(auth.userId, projectId);
    return ecomJson({ project, mock: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 批量出镜失败";
    const status = message.includes("不存在") ? 404 : message.includes("请先") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
