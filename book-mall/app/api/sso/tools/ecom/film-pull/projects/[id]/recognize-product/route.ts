import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { recognizeFilmPullProduct } from "@/lib/ecom/ecom-film-pull-recognize-product";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { userDraft?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  const userDraft = typeof body.userDraft === "string" ? body.userDraft : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await recognizeFilmPullProduct(auth.userId, id, { userDraft });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "识产品失败";
    const status = message.includes("请先") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
