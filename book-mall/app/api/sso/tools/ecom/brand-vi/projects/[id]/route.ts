import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomBrandViProject,
  getEcomBrandViProject,
  updateEcomBrandViProject,
} from "@/lib/ecom/ecom-brand-vi-service";
import {
  sanitizeBrandViChatMessages,
  type BrandViMeta,
  type BrandViSettings,
} from "@/lib/ecom/ecom-brand-vi-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getEcomBrandViProject(auth.userId, id);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: {
    title?: unknown;
    settings?: unknown;
    status?: unknown;
    meta?: unknown;
    chatHistory?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await updateEcomBrandViProject(auth.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as BrandViSettings)
          : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      chatHistory:
        body.chatHistory === undefined
          ? undefined
          : sanitizeBrandViChatMessages(body.chatHistory),
      meta:
        body.meta && typeof body.meta === "object"
          ? (body.meta as BrandViMeta)
          : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await deleteEcomBrandViProject(auth.userId, id);
    return ecomJson({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return ecomJson({ error: message }, { status: 404 });
  }
}
