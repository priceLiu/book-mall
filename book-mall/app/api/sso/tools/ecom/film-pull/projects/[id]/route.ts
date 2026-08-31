import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomFilmPullProject,
  getEcomFilmPullProject,
  patchFilmPullAnalyzeShots,
  updateEcomFilmPullProject,
} from "@/lib/ecom/ecom-film-pull-service";
import type { FilmPullSettings } from "@/lib/ecom/ecom-film-pull-types";
import type { FilmPullAnalyzePatch } from "@/lib/ecom/ecom-film-pull-structured";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomFilmPullProject(auth.userId, id);
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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (Array.isArray(body.shots)) {
      const project = await patchFilmPullAnalyzeShots(
        auth.userId,
        id,
        body.shots as FilmPullAnalyzePatch["shots"],
      );
      return NextResponse.json({ project });
    }
    const patch: Parameters<typeof updateEcomFilmPullProject>[2] = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.status === "string") patch.status = body.status;
    if (body.settings && typeof body.settings === "object") {
      patch.settings = body.settings as FilmPullSettings;
    }
    const project = await updateEcomFilmPullProject(auth.userId, id, patch);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message === "项目不存在" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    await deleteEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message === "项目不存在" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
