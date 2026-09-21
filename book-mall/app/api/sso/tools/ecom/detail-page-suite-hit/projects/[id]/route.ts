import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { reconcileHitRewriteProjectOnRead } from "@/lib/ecom/detail-page-suite-hit/hit-rewrite-service";
import {
  deleteDetailPageSuiteHitProject,
  getDetailPageSuiteHitProject,
  updateDetailPageSuiteHitProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteMeta,
  DetailPageSuiteReference,
  DetailPageSuiteSettings,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const raw = await getDetailPageSuiteHitProject(auth.userId, id);
  if (!raw) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const project = reconcileHitRewriteProjectOnRead(raw);
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const project = await updateDetailPageSuiteHitProject(auth.userId, id, {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.status === "string" ? { status: body.status } : {}),
    ...(body.brief !== undefined ? { brief: body.brief as DetailPageSuiteBrief | null } : {}),
    ...(body.settings !== undefined ? { settings: body.settings as DetailPageSuiteSettings } : {}),
    ...(body.references !== undefined
      ? { references: body.references as DetailPageSuiteReference[] }
      : {}),
    ...(body.suite !== undefined ? { suite: body.suite as DetailPageSuiteState } : {}),
    ...(body.meta !== undefined ? { meta: body.meta as DetailPageSuiteMeta | null } : {}),
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "无权限" }, { status: 403 });
  }
  const ok = await deleteDetailPageSuiteHitProject(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
