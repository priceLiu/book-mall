import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import {
  getSimpleFusionProject,
  syncSimpleFusionRenderResult,
  updateSimpleFusionProject,
} from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    let project = await getSimpleFusionProject(auth.userId, id);
    if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
    if (project.phase === "rendering") {
      project = await syncSimpleFusionRenderResult(auth.userId, id);
    }
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  try {
    const patch: Parameters<typeof updateSimpleFusionProject>[2] = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (body.settings && typeof body.settings === "object") {
      patch.settings = body.settings as Parameters<typeof updateSimpleFusionProject>[2]["settings"];
    }
    if (body.references && typeof body.references === "object") {
      patch.references = body.references as Parameters<typeof updateSimpleFusionProject>[2]["references"];
    }
    if (body.meta && typeof body.meta === "object") {
      patch.meta = body.meta as Parameters<typeof updateSimpleFusionProject>[2]["meta"];
    }
    const project = await updateSimpleFusionProject(auth.userId, id, patch);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    const status = message.includes("不存在") ? 404 : 400;
    return ecomJson({ error: message }, { status });
  }
}
