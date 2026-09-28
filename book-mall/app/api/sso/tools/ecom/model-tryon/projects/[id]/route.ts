import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  getEcomModelTryonProject,
  updateEcomModelTryonProject,
} from "@/lib/ecom/ecom-model-tryon-service";
import type { ModelTryonSettings } from "@/lib/ecom/ecom-model-tryon-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const project = await getEcomModelTryonProject(auth.userId, id);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateEcomModelTryonProject>[2] = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (body.settings && typeof body.settings === "object") {
    patch.settings = body.settings as ModelTryonSettings;
  }

  try {
    const project = await updateEcomModelTryonProject(auth.userId, id, patch);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message === "项目不存在" ? 404 : 500;
    return ecomJson({ error: message }, { status });
  }
}
