import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteUserSceneEntry,
  updateUserSceneEntry,
} from "@/lib/ecom/ecom-scene-library-service";
import { isSceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateUserSceneEntry>[2] = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.visualPrompt === "string") patch.visualPrompt = body.visualPrompt.trim();
    if (typeof body.archetype === "string" && isSceneArchetype(body.archetype)) {
      patch.archetype = body.archetype;
    }
    const entry = await updateUserSceneEntry(auth.userId, id, patch);
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message.includes("无权") || message.includes("不可") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const ok = await deleteUserSceneEntry(auth.userId, id);
    if (!ok) return NextResponse.json({ error: "条目不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("无权") || message.includes("不可") ? 403 : 500;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
