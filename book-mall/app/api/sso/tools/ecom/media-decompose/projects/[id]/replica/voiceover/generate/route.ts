import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateReplicaVoiceoverDraft } from "@/lib/ecom/ecom-media-decompose-replica";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { PlatformEntitlementError } from "@/lib/platform-gateway-entitlement";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function mapReplicaRouteError(e: unknown, fallback: string): { message: string; status: number } {
  if (e instanceof PlatformEntitlementError) {
    return { message: e.message, status: e.httpStatus };
  }
  if (e instanceof GatewayRequiredError) {
    return { message: e.message, status: 502 };
  }
  const message = e instanceof Error ? e.message : fallback;
  const status =
    message.includes("请先") ||
    message.includes("缺少") ||
    message.includes("不支持") ||
    message.includes("未返回有效")
      ? 400
      : 502;
  return { message, status };
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { productBrief?: unknown; sellingPoints?: unknown; modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const productBrief = typeof body.productBrief === "string" ? body.productBrief.trim() : undefined;
  const sellingPoints = typeof body.sellingPoints === "string" ? body.sellingPoints : undefined;
  const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await generateReplicaVoiceoverDraft(auth.userId, id, {
      productBrief,
      sellingPoints,
      modelKey,
    });
    return NextResponse.json(result);
  } catch (e) {
    const { message, status } = mapReplicaRouteError(e, "口播生成失败");
    return NextResponse.json({ error: message }, { status });
  }
}
