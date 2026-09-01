import { NextResponse } from "next/server";

import { reuseModelShotLibraryItem } from "@/lib/ecom/ecom-model-shot-reuse";
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
    const project = await reuseModelShotLibraryItem(auth.userId, projectId, savedAt);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "复用失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
