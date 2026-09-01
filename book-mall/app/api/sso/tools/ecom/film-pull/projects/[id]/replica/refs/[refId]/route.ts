import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { deleteFilmPullReplicaReference } from "@/lib/ecom/ecom-film-pull-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; refId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, refId } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await deleteFilmPullReplicaReference(auth.userId, id, refId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("请先") || message.includes("不存在") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
