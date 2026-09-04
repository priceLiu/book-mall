import { NextResponse } from "next/server";

import {
  getEcomOutfitVideoProject,
  syncEcomOutfitVideoRenderResult,
  updateEcomOutfitVideoProject,
} from "@/lib/ecom/ecom-outfit-video-service";
import type { OutfitVideoSettings } from "@/lib/ecom/ecom-outfit-video-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    let project = await getEcomOutfitVideoProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    project = await syncEcomOutfitVideoRenderResult(auth.userId, id);
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
    const project = await updateEcomOutfitVideoProject(auth.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as OutfitVideoSettings)
          : undefined,
      meta:
        body.meta && typeof body.meta === "object"
          ? (body.meta as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message.includes("不存在") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
