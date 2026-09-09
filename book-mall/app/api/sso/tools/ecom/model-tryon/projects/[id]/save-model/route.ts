import { NextResponse } from "next/server";

import { saveEcomModelTryonModelImage } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  await ctx.params;

  let body: { ossUrl?: string; title?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const ossUrl = body.ossUrl?.trim();
  if (!ossUrl) return NextResponse.json({ error: "缺少 ossUrl" }, { status: 400 });

  try {
    const result = await saveEcomModelTryonModelImage(auth.userId, {
      ossUrl,
      title: body.title,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
