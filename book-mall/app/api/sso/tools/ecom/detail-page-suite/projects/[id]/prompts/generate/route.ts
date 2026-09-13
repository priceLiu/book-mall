import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  generateAllEnabledPrompts,
  generateModulePrompts,
  rewriteSlotPrompt,
} from "@/lib/ecom/detail-page-suite/prompt-llm";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;
    const moduleId = typeof body.moduleId === "string" ? body.moduleId : undefined;
    const slotKey = typeof body.slotKey === "string" ? body.slotKey : undefined;
    const project =
      moduleId && slotKey
        ? await rewriteSlotPrompt({
            userId: auth.userId,
            projectId: id,
            moduleId,
            slotKey,
            modelKey,
          })
        : moduleId
          ? await generateModulePrompts({
              userId: auth.userId,
              projectId: id,
              moduleId,
              modelKey,
            })
          : await generateAllEnabledPrompts({
              userId: auth.userId,
              projectId: id,
              modelKey,
            });
    return NextResponse.json({ project });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成提示词失败" },
      { status: 400 },
    );
  }
}
