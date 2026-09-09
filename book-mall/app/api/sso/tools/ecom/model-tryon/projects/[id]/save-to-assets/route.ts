import { NextResponse } from "next/server";

import { saveEcomModelTryonResultToAssets } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const title = typeof body.title === "string" ? body.title : undefined;
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl : undefined;

  try {
    const result = await saveEcomModelTryonResultToAssets(auth.userId, id, { title, ossUrl });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    const status = message.includes("请先") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
