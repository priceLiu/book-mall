import { NextResponse } from "next/server";

import { syncEcomStoryboardSheetFromMeta } from "@/lib/ecom/ecom-storyboard-sheet-sync";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { schemeIndex?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* defaults */
  }
  const schemeIndex =
    typeof body.schemeIndex === "number" ? Math.max(0, Math.floor(body.schemeIndex)) : undefined;

  try {
    const result = await syncEcomStoryboardSheetFromMeta(auth.userId, id, { schemeIndex });
    if (!result.sheet) {
      return NextResponse.json(
        { error: "无法从交付内容解析结构化分镜，请让助手重新输出完整分镜表" },
        { status: 400 },
      );
    }
    const project = await getEcomStoryboardProject(auth.userId, id);
    return NextResponse.json({ project, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
