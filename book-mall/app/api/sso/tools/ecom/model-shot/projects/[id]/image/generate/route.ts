import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateModelShotImages } from "@/lib/ecom/ecom-model-shot-image";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const indexes = Array.isArray(body.indexes)
      ? body.indexes.filter((x): x is number => typeof x === "number")
      : undefined;
    const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;
    const imageSize = typeof body.imageSize === "string" ? body.imageSize : undefined;
    console.info("[model-shot] image/generate", {
      projectId: id,
      userId: auth.userId,
      indexes,
      modelKey,
    });
    const result = await generateModelShotImages({
      userId: auth.userId,
      projectId: id,
      indexes,
      modelKey,
      imageSize,
    });
    console.info("[model-shot] image/generate done", {
      projectId: id,
      generated: result.generated,
      failures: result.failures,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    console.error("[model-shot] image/generate failed", {
      projectId: id,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
