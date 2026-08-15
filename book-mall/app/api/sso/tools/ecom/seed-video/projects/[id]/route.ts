import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomSeedVideoProject,
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import {
  sanitizeSeedVideoChatMessages,
  type SeedVideoChatMessage,
  type SeedVideoPlan,
  type SeedVideoSettings,
} from "@/lib/ecom/ecom-seed-video-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomSeedVideoProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const chatHistory = Array.isArray(body.chatHistory)
      ? (sanitizeSeedVideoChatMessages(body.chatHistory) as SeedVideoChatMessage[])
      : undefined;
    const project = await updateEcomSeedVideoProject(auth.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      settings: body.settings as SeedVideoSettings | undefined,
      plan: body.plan as SeedVideoPlan | undefined,
      chatHistory,
      meta: body.meta as Record<string, unknown> | undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    await deleteEcomSeedVideoProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
