import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  generateAllEnabledPrompts,
  generateModulePrompts,
  rewriteSlotPrompt,
} from "@/lib/ecom/detail-page-suite/prompt-llm";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
/** 单模块 LLM 生成；批量由前端按 moduleId 分批调用 */
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
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
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "生成提示词失败" },
      { status: 400 },
    );
  }
}
