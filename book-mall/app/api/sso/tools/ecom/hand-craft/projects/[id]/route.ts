import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomHandCraftProject,
  getEcomHandCraftProject,
  updateEcomHandCraftProject,
} from "@/lib/ecom/ecom-hand-craft-service";
import {
  sanitizeHandCraftChatMessages,
  type HandCraftMeta,
  type HandCraftSettings,
} from "@/lib/ecom/ecom-hand-craft-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getEcomHandCraftProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await updateEcomHandCraftProject(auth.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as HandCraftSettings)
          : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      chatHistory:
        body.chatHistory === undefined
          ? undefined
          : sanitizeHandCraftChatMessages(body.chatHistory),
      meta:
        body.meta && typeof body.meta === "object"
          ? (body.meta as HandCraftMeta)
          : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await deleteEcomHandCraftProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
