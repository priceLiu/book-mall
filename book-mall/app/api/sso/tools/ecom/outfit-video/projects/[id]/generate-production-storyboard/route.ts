import { NextResponse } from "next/server";

import { generateEcomOutfitVideoProductionStoryboard } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const project = await generateEcomOutfitVideoProductionStoryboard(auth.userId, id);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "分镜制作表生成失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status: status === 404 ? 404 : 500 });
  }
}
