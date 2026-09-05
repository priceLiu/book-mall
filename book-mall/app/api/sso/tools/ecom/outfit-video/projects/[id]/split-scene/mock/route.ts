import { NextResponse } from "next/server";

import { splitEcomOutfitVideoScenes } from "@/lib/ecom/ecom-outfit-video-service";
import { isOutfitVideoMockAllowed } from "@/lib/ecom/ecom-outfit-video-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!isOutfitVideoMockAllowed()) {
    return NextResponse.json({ error: "Mock 拆镜不可用" }, { status: 403 });
  }
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const { project, envelope } = await splitEcomOutfitVideoScenes(auth.userId, id, { mock: true });
    return NextResponse.json({ project, envelope, mock: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 拆镜失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
