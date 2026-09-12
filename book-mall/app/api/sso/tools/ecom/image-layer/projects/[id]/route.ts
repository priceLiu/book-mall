import { NextResponse } from "next/server";

import type { ImageLayerWorkspace } from "@/lib/ecom/ecom-image-layer-project-types";
import {
  deleteEcomImageLayerProject,
  getEcomImageLayerProject,
  saveEcomImageLayerWorkspace,
  updateEcomImageLayerProject,
} from "@/lib/ecom/ecom-image-layer-project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const project = await getEcomImageLayerProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    if (body.workspace && typeof body.workspace === "object" && !Array.isArray(body.workspace)) {
      const project = await saveEcomImageLayerWorkspace(
        auth.userId,
        id,
        body.workspace as ImageLayerWorkspace,
      );
      return NextResponse.json({ project });
    }
    const patch: Parameters<typeof updateEcomImageLayerProject>[2] = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.status === "string") patch.status = body.status;
    if (body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)) {
      patch.meta = body.meta as Record<string, unknown>;
    }
    const project = await updateEcomImageLayerProject(auth.userId, id, patch);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message === "项目不存在" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    await deleteEcomImageLayerProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message === "项目不存在" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
