import { NextResponse } from "next/server";

import { patchEcomOutfitVideoLooks } from "@/lib/ecom/ecom-outfit-video-service";
import type { VtonLookSpec } from "@/lib/ecom/ecom-vton/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { looks?: VtonLookSpec[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.looks)) {
    return NextResponse.json({ error: "缺少 looks 数组" }, { status: 400 });
  }

  try {
    const project = await patchEcomOutfitVideoLooks(auth.userId, id, body.looks);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新搭配失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
