import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { recognizeReplicaProduct } from "@/lib/ecom/ecom-media-decompose-replica";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { PlatformEntitlementError } from "@/lib/platform-gateway-entitlement";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

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
    message.includes("请先") || message.includes("缺少") || message.includes("不支持")
      ? 400
      : 502;
  return { message, status };
}

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
    const result = await recognizeReplicaProduct(auth.userId, id, modelKey);
    return NextResponse.json(result);
  } catch (e) {
    const { message, status } = mapReplicaRouteError(e, "识产品失败");
    return NextResponse.json({ error: message }, { status });
  }
}
