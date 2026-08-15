import { NextResponse } from "next/server";

import { generateHandCraftSketchReference } from "@/lib/ecom/ecom-hand-craft-sketch-gen";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** AI 生成手绘线稿（wan2.7-image），写入 references 槽位 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "请填写 Prompt" }, { status: 400 });
  }
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : undefined;
  const resetFlow = body.resetFlow === true || String(body.resetFlow) === "1";

  try {
    const result = await generateHandCraftSketchReference({
      userId: auth.userId,
      projectId,
      prompt,
      modelKey,
      resetFlow,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status =
      message === "项目不存在"
        ? 404
        : message.includes("请填写") || message.includes("最多")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
