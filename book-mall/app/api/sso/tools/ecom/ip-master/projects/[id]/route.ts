import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomIpMasterProject,
  getEcomIpMasterProject,
  updateEcomIpMasterProject,
} from "@/lib/ecom/ecom-ip-master-service";
import {
  sanitizeIpMasterChatMessages,
  type IpMasterMeta,
  type IpMasterSettings,
} from "@/lib/ecom/ecom-ip-master-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getEcomIpMasterProject(auth.userId, id);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: {
    title?: unknown;
    brief?: unknown;
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
    const project = await updateEcomIpMasterProject(auth.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      brief:
        body.brief && typeof body.brief === "object"
          ? (body.brief as Record<string, unknown>)
          : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as IpMasterSettings)
          : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      chatHistory:
        body.chatHistory === undefined
          ? undefined
          : sanitizeIpMasterChatMessages(body.chatHistory),
      meta:
        body.meta && typeof body.meta === "object"
          ? (body.meta as IpMasterMeta)
          : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await deleteEcomIpMasterProject(auth.userId, id);
    return ecomJson({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
