import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteEcomStoryboardProject,
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import {
  parseStoryboardSheet,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const project = await getEcomStoryboardProject(auth.userId, id);
  if (!project) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const patch: Parameters<typeof updateEcomStoryboardProject>[2] = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (body.brief && typeof body.brief === "object") {
      patch.brief = body.brief as Record<string, unknown>;
    }
    if (body.settings && typeof body.settings === "object") {
      patch.settings = body.settings as Record<string, unknown>;
    }
    if (Array.isArray(body.references)) patch.references = body.references as never;
    if (Array.isArray(body.chatHistory)) patch.chatHistory = body.chatHistory as never;
    if (body.sheet !== undefined) {
      if (body.sheet === null) {
        patch.sheet = null;
      } else {
        patch.sheet = parseStoryboardSheet(body.sheet as StoryboardSheet);
      }
    }
    if (typeof body.status === "string") patch.status = body.status;
    if (body.meta && typeof body.meta === "object") {
      patch.meta = body.meta as Record<string, unknown>;
    }
    const project = await updateEcomStoryboardProject(auth.userId, id, patch);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await deleteEcomStoryboardProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
