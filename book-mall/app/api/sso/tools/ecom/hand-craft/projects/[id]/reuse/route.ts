import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { reuseHandCraftLibraryItem } from "@/lib/ecom/ecom-hand-craft-reuse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 一键复用：从手伴工作流快照创建新项目（保留线稿与槽位说明，去掉成图） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const savedAt = typeof body.savedAt === "string" ? body.savedAt.trim() : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await reuseHandCraftLibraryItem(auth.userId, projectId, savedAt);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "复用失败";
    const status = message.includes("不存在") || message.includes("找不到") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
