import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { saveReplicaCopyFields } from "@/lib/ecom/ecom-media-decompose-replica";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { PlatformEntitlementError } from "@/lib/platform-gateway-entitlement";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { productBrief?: unknown; sellingPoints?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const productBrief = typeof body.productBrief === "string" ? body.productBrief : undefined;
  const sellingPoints = typeof body.sellingPoints === "string" ? body.sellingPoints : undefined;

  if (productBrief === undefined && sellingPoints === undefined) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await saveReplicaCopyFields(auth.userId, id, {
      productBrief,
      sellingPoints,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
