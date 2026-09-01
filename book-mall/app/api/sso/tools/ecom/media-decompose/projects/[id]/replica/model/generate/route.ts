import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateReplicaModelImage } from "@/lib/ecom/ecom-media-decompose-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : undefined;
  const imageSize = typeof body.imageSize === "string" ? body.imageSize.trim() : undefined;

  if (!prompt) {
    return NextResponse.json({ error: "请填写 Prompt" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await generateReplicaModelImage(auth.userId, id, {
      prompt,
      modelKey,
      imageSize,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "模特图生成失败";
    const status = message.includes("请先") || message.includes("请填写") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
