import { NextResponse } from "next/server";

import { lockEcomOutfitVideoTryonResults } from "@/lib/ecom/ecom-outfit-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { resultIds?: string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.resultIds) || body.resultIds.length === 0) {
    return NextResponse.json({ error: "请提供 resultIds" }, { status: 400 });
  }

  try {
    const project = await lockEcomOutfitVideoTryonResults(auth.userId, id, body.resultIds);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "锁定参考失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
