import { NextResponse } from "next/server";

import { unlockEcomModelTryonLockedLook } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; lookId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, lookId } = await ctx.params;

  try {
    const project = await unlockEcomModelTryonLockedLook(auth.userId, id, lookId);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "取消锁定失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
