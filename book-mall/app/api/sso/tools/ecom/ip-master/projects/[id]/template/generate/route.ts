import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { generateIpMasterStructuredTemplate } from "@/lib/ecom/ecom-ip-master-template-generate";
import type { IpMasterRegenerateTarget } from "@/lib/ecom/ecom-ip-master-template-schema";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function parseRegenerateTarget(raw: unknown): IpMasterRegenerateTarget | undefined {
  if (raw === "both" || raw === "imagePrompt" || raw === "structured") return raw;
  return undefined;
}

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
  const regenerateTarget = parseRegenerateTarget(body.regenerateTarget);
  const draftTemplate =
    body.draftTemplate && typeof body.draftTemplate === "object"
      ? (body.draftTemplate as Record<string, unknown>)
      : undefined;
  const draftImagePrompt =
    body.draftImagePrompt && typeof body.draftImagePrompt === "object"
      ? (body.draftImagePrompt as { positive: string; negative?: string })
      : undefined;

  try {
    const result = await generateIpMasterStructuredTemplate({
      userId: auth.userId,
      projectId,
      modelKey,
      regenerateTarget,
      draftTemplate,
      draftImagePrompt,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status = message === "项目不存在" ? 404 : 500;
    return ecomJson({ error: message }, { status });
  }
}
