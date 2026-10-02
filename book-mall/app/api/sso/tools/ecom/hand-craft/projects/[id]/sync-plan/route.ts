import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { syncEcomHandCraftProjectPlanFromAssets } from "@/lib/ecom/ecom-hand-craft-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 从「我的资产」回填本项目中缺失的槽位成图（plan 与 Gateway 不一致时） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const { project, recoveredImages } = await syncEcomHandCraftProjectPlanFromAssets(
    auth.userId,
    id,
  );
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project, recoveredImages });
}
