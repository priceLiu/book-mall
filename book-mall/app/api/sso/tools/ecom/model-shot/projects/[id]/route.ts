import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomModelShotProject,
  getEcomModelShotProject,
  updateEcomModelShotProject,
} from "@/lib/ecom/ecom-model-shot-service";
import type { ModelShotBrief, ModelShotMeta, ModelShotPlan, ModelShotSettings } from "@/lib/ecom/ecom-model-shot-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getEcomModelShotProject(auth.userId, id);
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
  const project = await updateEcomModelShotProject(auth.userId, id, {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.status === "string" ? { status: body.status } : {}),
    ...(body.brief !== undefined ? { brief: body.brief as ModelShotBrief | null } : {}),
    ...(body.settings !== undefined ? { settings: body.settings as ModelShotSettings } : {}),
    ...(body.references !== undefined ? { references: body.references as never } : {}),
    ...(body.chatHistory !== undefined ? { chatHistory: body.chatHistory as never } : {}),
    ...(body.plan !== undefined ? { plan: body.plan as ModelShotPlan } : {}),
    ...(body.meta !== undefined ? { meta: body.meta as ModelShotMeta | null } : {}),
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
  const ok = await deleteEcomModelShotProject(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
