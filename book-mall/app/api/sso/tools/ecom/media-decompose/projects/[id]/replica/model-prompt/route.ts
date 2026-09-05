import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateReplicaModelPrompt } from "@/lib/ecom/ecom-media-decompose-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await generateReplicaModelPrompt(auth.userId, id, modelKey);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成 Prompt 失败";
    const status = message.includes("请先") || message.includes("缺少") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
