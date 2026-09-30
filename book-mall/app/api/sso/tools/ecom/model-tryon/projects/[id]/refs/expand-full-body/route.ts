import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { startEcomModelTryonExpandFullBody } from "@/lib/ecom/ecom-model-tryon-service";
import { parseVtonModelPipelineRequest } from "@/lib/ecom/ecom-vton-model-pipeline-opts";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const pipeline = parseVtonModelPipelineRequest(body);

  try {
    const project = await startEcomModelTryonExpandFullBody(auth.userId, id, pipeline);
    return ecomJson({ project });
  } catch (e) {
    const { message, status } = formatEcomImageGenUserError(e);
    return ecomJson({ error: message }, { status });
  }
}
