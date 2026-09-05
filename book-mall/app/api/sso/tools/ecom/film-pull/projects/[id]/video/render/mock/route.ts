import { NextResponse } from "next/server";

import {
  applyMockFilmPullFinalRender,
  isFilmPullMockAllowed,
} from "@/lib/ecom/ecom-film-pull-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Dev only · 跳过 MediaRender，写入 mock 成片 URL */
export async function POST(_req: Request, ctx: Ctx) {
  if (!isFilmPullMockAllowed()) {
    return NextResponse.json({ error: "Mock 合成不可用" }, { status: 403 });
  }

  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    const project = await applyMockFilmPullFinalRender(auth.userId, projectId);
    return NextResponse.json({ project, mock: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 合成失败";
    const status = message.includes("不存在") ? 404 : message.includes("请先") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
