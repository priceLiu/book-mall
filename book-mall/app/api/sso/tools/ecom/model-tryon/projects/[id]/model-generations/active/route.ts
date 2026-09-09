import { NextResponse } from "next/server";

import { setActiveEcomModelTryonGeneration } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { generationId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const generationId = body.generationId?.trim();
  if (!generationId) {
    return NextResponse.json({ error: "缺少 generationId" }, { status: 400 });
  }

  try {
    const project = await setActiveEcomModelTryonGeneration(auth.userId, id, generationId);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "切换模特失败";
    const status = message === "项目不存在" || message.includes("未找到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
