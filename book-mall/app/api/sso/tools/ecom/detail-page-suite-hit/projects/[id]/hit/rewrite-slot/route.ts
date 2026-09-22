import { NextResponse } from "next/server";

import { rewriteHitSingleSlot } from "@/lib/ecom/detail-page-suite-hit/hit-rewrite-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() : "";
  const slotKey = typeof body.slotKey === "string" ? body.slotKey.trim() : "";
  if (!moduleId || !slotKey) {
    return NextResponse.json({ error: "缺少 moduleId 或 slotKey" }, { status: 400 });
  }
  try {
    const project = await rewriteHitSingleSlot({
      userId: auth.userId,
      projectId: id,
      moduleId,
      slotKey,
      chatModelKey: typeof body.chatModelKey === "string" ? body.chatModelKey : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "重写失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
