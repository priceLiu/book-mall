import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import type { SimpleFusionComposeWorkbenchState } from "@/lib/ecom/simple-fusion-video/compose-workbench";
import { renderSimpleFusionDanceVideo } from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { composeWorkbench?: SimpleFusionComposeWorkbenchState } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }
  try {
    const project = await renderSimpleFusionDanceVideo(auth.userId, id, {
      workbench: body.composeWorkbench,
      replaceInFlight: true,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "合成失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
