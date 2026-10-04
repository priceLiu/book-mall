import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { runSimpleFusionPipeline } from "@/lib/ecom/simple-fusion-video/service";
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
  const stepRaw = typeof body.step === "string" ? body.step.trim() : "all";
  const step =
    stepRaw === "fusion" || stepRaw === "video" || stepRaw === "render" || stepRaw === "all"
      ? stepRaw
      : "all";
  const lookIdsRaw = body.lookIds;
  const lookIds = Array.isArray(lookIdsRaw)
    ? lookIdsRaw.filter((x): x is string => typeof x === "string")
    : undefined;
  try {
    const project = await runSimpleFusionPipeline(auth.userId, id, { step, lookIds });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
