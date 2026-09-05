import { NextResponse } from "next/server";

import { parseHandCraftAssistantOutput } from "@/lib/ecom/ecom-hand-craft-markdown-parse";
import {
  getEcomHandCraftProject,
  patchHandCraftSlotPrompts,
  updateEcomHandCraftProject,
} from "@/lib/ecom/ecom-hand-craft-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * 助手输出 → plan。
 *
 * 只做两件事：把当前步骤写回 meta.workflow.currentStepId，把助手给出的槽位调整表
 * 覆盖到本步槽位。出图仍由工作区显式触发，助手不会偷偷发起生成。
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { markdown?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* 允许空 body */
  }

  const existing = await getEcomHandCraftProject(auth.userId, id);
  if (!existing) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const markdown =
    typeof body.markdown === "string" && body.markdown.trim()
      ? body.markdown
      : (existing.meta?.lastAssistantRaw ?? "");
  if (!markdown.trim()) {
    return NextResponse.json({ project: existing });
  }

  try {
    const { stepId, overrides } = parseHandCraftAssistantOutput(markdown);
    if (!stepId) return NextResponse.json({ project: existing });

    let project = await updateEcomHandCraftProject(auth.userId, id, {
      meta: { workflow: { currentStepId: stepId } },
    });
    if (overrides.length > 0) {
      project = await patchHandCraftSlotPrompts(auth.userId, id, stepId, overrides);
    }
    return NextResponse.json({ project, stepId, overrides: overrides.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
