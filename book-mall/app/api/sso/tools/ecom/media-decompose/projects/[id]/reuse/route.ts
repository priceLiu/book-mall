import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { reuseMediaDecomposeLibraryItem } from "@/lib/ecom/ecom-media-decompose-reuse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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
    const project = await reuseMediaDecomposeLibraryItem(auth.userId, projectId, savedAt);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "复用失败";
    const status =
      message === "项目不存在" || message === "找不到该版本的保存记录"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
