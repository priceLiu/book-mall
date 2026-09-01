import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateFilmPullReplicaModelImage } from "@/lib/ecom/ecom-film-pull-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { prompt?: unknown; modelKey?: unknown; imageSize?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await generateFilmPullReplicaModelImage(auth.userId, id, {
      prompt,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生图失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
