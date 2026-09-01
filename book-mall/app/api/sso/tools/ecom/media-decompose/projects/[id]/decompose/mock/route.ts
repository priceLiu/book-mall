import { NextResponse } from "next/server";

import {
  applyMockMediaDecomposeResult,
  isMediaDecomposeMockAllowed,
} from "@/lib/ecom/ecom-media-decompose-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Dev only · 跳过 Gateway，写入 mock 拆解结果 */
export async function POST(req: Request, ctx: Ctx) {
  if (!isMediaDecomposeMockAllowed()) {
    return NextResponse.json({ error: "Mock 拆解不可用" }, { status: 403 });
  }

  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: { prompt?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;

  try {
    const project = await applyMockMediaDecomposeResult(auth.userId, projectId, { prompt });
    return NextResponse.json({ project, mock: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 拆解失败";
    const status = message.includes("不存在") ? 404 : message.includes("请先") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
