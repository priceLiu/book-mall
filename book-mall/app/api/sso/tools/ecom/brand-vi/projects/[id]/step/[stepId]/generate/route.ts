import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { generateBrandViStepImages } from "@/lib/ecom/ecom-brand-vi-image";
import { getEcomBrandViProject } from "@/lib/ecom/ecom-brand-vi-service";
import { isBrandViStepId } from "@/lib/ecom/ecom-brand-vi-steps";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, stepId } = await ctx.params;
  if (!isBrandViStepId(stepId)) {
    return ecomJson({ error: "未知步骤" }, { status: 400 });
  }

  let body: {
    indexes?: unknown;
    modelKey?: unknown;
    concurrency?: unknown;
    imageSize?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* 允许空 body：表示生成本步全部槽位 */
  }

  const indexes = Array.isArray(body.indexes)
    ? body.indexes
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0)
    : undefined;

  try {
    const result = await generateBrandViStepImages({
      userId: auth.userId,
      projectId: id,
      stepId,
      indexes,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      concurrency:
        typeof body.concurrency === "number" ? body.concurrency : undefined,
      imageSize:
        typeof body.imageSize === "string" ? body.imageSize : undefined,
    });
    const project = await getEcomBrandViProject(auth.userId, id);
    return ecomJson({ ...result, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
