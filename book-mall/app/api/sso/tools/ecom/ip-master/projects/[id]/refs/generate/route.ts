import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { generateIpMasterBenchmarkImage } from "@/lib/ecom/ecom-ip-master-benchmark-gen";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** AI 生成基准立绘（使用审阅页确认的生图提示词） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : undefined;
  const imagePrompt =
    body.imagePrompt && typeof body.imagePrompt === "object"
      ? (body.imagePrompt as { positive: string; negative?: string })
      : undefined;

  try {
    const result = await generateIpMasterBenchmarkImage({
      userId: auth.userId,
      projectId,
      modelKey,
      imagePrompt,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status = message === "项目不存在" ? 404 : 500;
    return ecomJson({ error: message }, { status });
  }
}
