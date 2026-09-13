import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteDetailPageSuiteProject,
  getDetailPageSuiteProject,
  updateDetailPageSuiteProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type {
  DetailPageSuiteBrief,
  DetailPageSuiteChatMessage,
  DetailPageSuiteMeta,
  DetailPageSuiteReference,
  DetailPageSuiteSettings,
  DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getDetailPageSuiteProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
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
  const project = await updateDetailPageSuiteProject(auth.userId, id, {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.status === "string" ? { status: body.status } : {}),
    ...(body.brief !== undefined ? { brief: body.brief as DetailPageSuiteBrief | null } : {}),
    ...(body.settings !== undefined ? { settings: body.settings as DetailPageSuiteSettings } : {}),
    ...(body.references !== undefined
      ? { references: body.references as DetailPageSuiteReference[] }
      : {}),
    ...(body.chatHistory !== undefined
      ? { chatHistory: body.chatHistory as DetailPageSuiteChatMessage[] }
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
  const ok = await deleteDetailPageSuiteProject(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
